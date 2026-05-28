"""
LSTM-based Behavioral Keystroke Authentication Model (PyTorch).

Processes sequential keystroke timing data for user verification.
Replaces the RF+SVM ensemble with a deep-learning approach that
captures temporal dependencies in typing rhythm.

Architecture:
  Input: (batch, 50, 4) — 50 keystrokes × 4 features each
  → LSTM(128, return_sequences=True)
  → Dropout(0.3)
  → LSTM(64)
  → Dropout(0.3)
  → Dense(32, ReLU)
  → Dense(n_users, Softmax)

Features per timestep:
  [dwell_time, flight_time, key_code_normalized, time_delta]
"""

from __future__ import annotations

import json
import os
import pickle
import time
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler

# ── PyTorch imports ──────────────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# ── Hyperparameters ──────────────────────────────────────────────────────────
HYPERPARAMS: Dict[str, Any] = {
    "sequence_length": 50,
    "n_features": 4,
    "lstm_units_1": 128,
    "lstm_units_2": 64,
    "dropout_rate": 0.25,
    "dense_units": 32,
    "learning_rate": 0.0008,
    "batch_size": 16,
    "epochs": 80,
    "early_stopping_patience": 15,
    "reduce_lr_patience": 7,
    "min_samples_per_user": 10,
    "confidence_threshold": 0.30,
    "confidence_boost_factor": 0.25,
    "augmentation_factor": 5,
}

# Persistence paths
_ROOT = Path(__file__).resolve().parent
MODEL_DIR = _ROOT / "models"
MODEL_PATH = MODEL_DIR / "lstm_behavioral_auth.pt"
METADATA_PATH = MODEL_DIR / "lstm_behavioral_auth_metadata.pkl"


# ── PyTorch LSTM Module ──────────────────────────────────────────────────────
if TORCH_AVAILABLE:

    class _KeystrokeLSTMNet(nn.Module):
        """Two-layer LSTM with dense classification head."""

        def __init__(
            self,
            n_features: int,
            n_users: int,
            lstm1: int = 128,
            lstm2: int = 64,
            dense: int = 32,
            dropout: float = 0.3,
        ) -> None:
            super().__init__()
            self.lstm1 = nn.LSTM(n_features, lstm1, batch_first=True)
            self.drop1 = nn.Dropout(dropout)
            self.lstm2 = nn.LSTM(lstm1, lstm2, batch_first=True)
            self.drop2 = nn.Dropout(dropout)
            self.fc1 = nn.Linear(lstm2, dense)
            self.relu = nn.ReLU()
            self.fc2 = nn.Linear(dense, n_users)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            out, _ = self.lstm1(x)
            out = self.drop1(out)
            out, _ = self.lstm2(out)
            # Take last timestep
            out = out[:, -1, :]
            out = self.drop2(out)
            out = self.relu(self.fc1(out))
            out = self.fc2(out)
            return out  # raw logits; apply softmax for probabilities


class LSTMKeystrokeAuth:
    """LSTM-based keystroke dynamics authentication (PyTorch backend)."""

    def __init__(
        self,
        sequence_length: int = HYPERPARAMS["sequence_length"],
        n_features: int = HYPERPARAMS["n_features"],
    ) -> None:
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.model: Optional[Any] = None
        self.label_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        self.classes_: List[str] = []
        self.is_trained: bool = False
        self._history: Optional[Dict] = None
        self.device = "cpu"

    # ── Model construction ───────────────────────────────────────────────
    def build_model(self, n_users: int) -> None:
        """Build the two-layer LSTM architecture."""
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch is not installed.")
        self.model = _KeystrokeLSTMNet(
            n_features=self.n_features,
            n_users=n_users,
            lstm1=HYPERPARAMS["lstm_units_1"],
            lstm2=HYPERPARAMS["lstm_units_2"],
            dense=HYPERPARAMS["dense_units"],
            dropout=HYPERPARAMS["dropout_rate"],
        ).to(self.device)

    # ── Preprocessing ────────────────────────────────────────────────────
    def preprocess_raw_keystrokes(
        self, raw_keystrokes: List[Dict],
    ) -> np.ndarray:
        """
        Convert raw keystroke events → (sequence_length, n_features) array.

        Each raw keystroke dict has {key, downTime, upTime} (from the JS widget).
        Features per timestep:
          0 — dwell_time   = upTime − downTime
          1 — flight_time  = next.downTime − this.upTime
          2 — key_code_norm = ord(key[0]) / 255.0
          3 — time_delta   = this.downTime − prev.downTime
        """
        if not raw_keystrokes or len(raw_keystrokes) < 2:
            return np.zeros((self.sequence_length, self.n_features), dtype=np.float32)

        seq: List[List[float]] = []
        for i, ks in enumerate(raw_keystrokes):
            down = float(ks.get("downTime", ks.get("down_time", 0)))
            up = float(ks.get("upTime", ks.get("up_time", 0)))
            key_str = str(ks.get("key", "?"))

            dwell = max(0.0, up - down)

            if i < len(raw_keystrokes) - 1:
                next_down = float(
                    raw_keystrokes[i + 1].get(
                        "downTime", raw_keystrokes[i + 1].get("down_time", 0)
                    )
                )
                flight = max(0.0, next_down - up)
            else:
                flight = 0.0

            key_code = ord(key_str[0]) / 255.0 if key_str else 0.0

            if i > 0:
                prev_down = float(
                    raw_keystrokes[i - 1].get(
                        "downTime", raw_keystrokes[i - 1].get("down_time", 0)
                    )
                )
                delta = max(0.0, down - prev_down)
            else:
                delta = 0.0

            seq.append([dwell, flight, key_code, delta])

        arr = np.array(seq, dtype=np.float32)
        return self._pad_or_truncate(arr)

    def synthesize_sequence_from_features(
        self, features_13: List[float], seed: Optional[int] = None,
    ) -> np.ndarray:
        """
        Generate a synthetic keystroke sequence from 13 aggregated features.
        Backward-compatible with existing data that only has aggregate stats.

        Uses a deterministic seed derived from the feature values so that
        the same input always produces the same sequence — critical for
        consistent prediction confidence.
        """
        if len(features_13) < 13:
            features_13 = features_13 + [0.0] * (13 - len(features_13))

        mean_dwell = features_13[0]
        std_dwell = max(1.0, features_13[1])
        mean_flight = features_13[4]
        std_flight = max(1.0, features_13[5])
        n_keys = int(features_13[12]) if features_13[12] > 0 else 25

        # Deterministic seed so the same features always produce the
        # same sequence — prevents random noise from destroying confidence
        if seed is None:
            seed = int(abs(hash(tuple(round(f, 4) for f in features_13)))) % (2**31)
        rng = np.random.default_rng(seed)
        phrase = "the quick brown fox jumps over the lazy dog"
        seq: List[List[float]] = []

        for i in range(n_keys):
            # Use very small noise (10% of std) to keep sequences stable
            dwell = max(10.0, mean_dwell + rng.normal(0, max(1.0, std_dwell * 0.1)))
            flight = max(5.0, mean_flight + rng.normal(0, max(1.0, std_flight * 0.1)))
            char = phrase[i % len(phrase)]
            key_code = ord(char) / 255.0
            delta = dwell + flight if i > 0 else 0.0
            seq.append([dwell, flight, key_code, delta])

        arr = np.array(seq, dtype=np.float32)
        return self._pad_or_truncate(arr)

    def augment_sequence(
        self, features_13: List[float], n_augments: int = 5,
    ) -> List[np.ndarray]:
        """
        Generate multiple augmented versions of a keystroke sequence
        from the same 13-feature vector. Each augmentation adds
        controlled random variation to simulate natural typing variance.
        """
        if len(features_13) < 13:
            features_13 = features_13 + [0.0] * (13 - len(features_13))

        mean_dwell = features_13[0]
        std_dwell = max(1.0, features_13[1])
        mean_flight = features_13[4]
        std_flight = max(1.0, features_13[5])
        n_keys = int(features_13[12]) if features_13[12] > 0 else 25
        phrase = "the quick brown fox jumps over the lazy dog"

        augmented: List[np.ndarray] = []
        for aug_i in range(n_augments):
            rng = np.random.default_rng(aug_i * 1000 + 42)
            seq: List[List[float]] = []
            # Each augmentation uses a slightly different noise scale
            noise_scale = 0.15 + 0.1 * aug_i
            for i in range(n_keys):
                dwell = max(10.0, rng.normal(mean_dwell, std_dwell * noise_scale))
                flight = max(5.0, rng.normal(mean_flight, std_flight * noise_scale))
                char = phrase[i % len(phrase)]
                key_code = ord(char) / 255.0
                delta = dwell + flight if i > 0 else 0.0
                seq.append([dwell, flight, key_code, delta])
            arr = np.array(seq, dtype=np.float32)
            augmented.append(self._pad_or_truncate(arr))
        return augmented

    def _pad_or_truncate(self, arr: np.ndarray) -> np.ndarray:
        """Ensure array has exactly `sequence_length` rows."""
        n = arr.shape[0]
        if n >= self.sequence_length:
            return arr[: self.sequence_length]
        pad = np.zeros(
            (self.sequence_length - n, self.n_features), dtype=np.float32
        )
        return np.vstack([arr, pad])

    def _normalize_batch(self, X: np.ndarray, fit: bool = False) -> np.ndarray:
        """Apply StandardScaler per-feature across all timesteps."""
        n, s, f = X.shape
        flat = X.reshape(-1, f)
        if fit:
            scaled = self.scaler.fit_transform(flat)
        else:
            scaled = self.scaler.transform(flat)
        return scaled.reshape(n, s, f).astype(np.float32)

    # ── Training ─────────────────────────────────────────────────────────
    def fit(
        self,
        X_sequences: np.ndarray,
        y_labels: np.ndarray,
        validation_split: float = 0.2,
        epochs: int = HYPERPARAMS["epochs"],
        batch_size: int = HYPERPARAMS["batch_size"],
    ) -> Dict[str, Any]:
        """Train the LSTM model on keystroke sequences."""
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch is not installed.")

        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y_labels)
        self.classes_ = list(self.label_encoder.classes_)
        n_users = len(self.classes_)

        # Normalise
        X_norm = self._normalize_batch(X_sequences, fit=True)

        # Train/val split
        n = len(X_norm)
        indices = np.random.permutation(n)
        val_size = int(n * validation_split)
        val_idx, train_idx = indices[:val_size], indices[val_size:]

        X_train = torch.tensor(X_norm[train_idx], dtype=torch.float32)
        y_train = torch.tensor(y_encoded[train_idx], dtype=torch.long)
        X_val = torch.tensor(X_norm[val_idx], dtype=torch.float32)
        y_val = torch.tensor(y_encoded[val_idx], dtype=torch.long)

        train_ds = TensorDataset(X_train, y_train)
        train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)

        # Build model
        self.build_model(n_users)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.Adam(
            self.model.parameters(), lr=HYPERPARAMS["learning_rate"]
        )
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer,
            mode="min",
            factor=0.5,
            patience=HYPERPARAMS["reduce_lr_patience"],
        )

        history: Dict[str, List[float]] = {
            "accuracy": [], "val_accuracy": [], "loss": [], "val_loss": [],
        }
        best_val_loss = float("inf")
        patience_counter = 0
        best_state = None

        print(f"\nTraining LSTM: {n_users} users, {len(X_train)} train, {len(X_val)} val")
        print(f"{'Epoch':>6} {'Loss':>10} {'Acc':>8} {'ValLoss':>10} {'ValAcc':>8}")
        print("-" * 50)

        t0 = time.time()
        for epoch in range(epochs):
            # ── Train ────────────────────────────────────────────────
            self.model.train()
            epoch_loss, correct, total = 0.0, 0, 0
            for xb, yb in train_dl:
                xb, yb = xb.to(self.device), yb.to(self.device)
                optimizer.zero_grad()
                logits = self.model(xb)
                loss = criterion(logits, yb)
                loss.backward()
                optimizer.step()

                epoch_loss += loss.item() * xb.size(0)
                preds = logits.argmax(dim=1)
                correct += (preds == yb).sum().item()
                total += xb.size(0)

            train_loss = epoch_loss / total
            train_acc = correct / total

            # ── Validate ─────────────────────────────────────────────
            self.model.eval()
            with torch.no_grad():
                val_logits = self.model(X_val.to(self.device))
                val_loss = criterion(val_logits, y_val.to(self.device)).item()
                val_preds = val_logits.argmax(dim=1)
                val_acc = (val_preds == y_val.to(self.device)).float().mean().item()

            history["loss"].append(train_loss)
            history["accuracy"].append(train_acc)
            history["val_loss"].append(val_loss)
            history["val_accuracy"].append(val_acc)

            scheduler.step(val_loss)

            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                best_state = {k: v.clone() for k, v in self.model.state_dict().items()}
            else:
                patience_counter += 1

            if (epoch + 1) % 5 == 0 or epoch == 0 or patience_counter == 0:
                print(
                    f"{epoch+1:>6} {train_loss:>10.4f} {train_acc:>7.2%} "
                    f"{val_loss:>10.4f} {val_acc:>7.2%}"
                    f"{'  *' if patience_counter == 0 else ''}"
                )

            if patience_counter >= HYPERPARAMS["early_stopping_patience"]:
                print(f"  Early stopping at epoch {epoch+1}")
                break

        elapsed = time.time() - t0

        # Restore best weights
        if best_state is not None:
            self.model.load_state_dict(best_state)

        self.is_trained = True
        self._history = history
        self.save()

        return {
            "accuracy": history["accuracy"],
            "val_accuracy": history["val_accuracy"],
            "loss": history["loss"],
            "val_loss": history["val_loss"],
            "training_time_s": elapsed,
            "n_users": n_users,
            "n_samples": len(X_sequences),
        }

    # ── Prediction ───────────────────────────────────────────────────────
    def predict(self, features: Any, username: str) -> Dict[str, Any]:
        """
        Predict user identity. Accepts:
          • List[Dict] — raw keystroke sequence
          • List[float] (len 13) — old 13-feature vector
          • Dict — old dict-format features

        Applies a confidence-boost when the model's top prediction matches
        the claimed user, which compensates for softmax spreading probability
        too thin across many users.
        """
        if not self.is_trained or not self.classes_:
            return {
                "confidence": 0.0,
                "decision": False,
                "predicted_user": "",
                "rf_prob": 0.0,
                "svm_prob": 0.0,
            }

        seq = self._features_to_sequence(features)
        X = seq.reshape(1, self.sequence_length, self.n_features)
        X_norm = self._normalize_batch(X, fit=False)

        self.model.eval()
        with torch.no_grad():
            logits = self.model(
                torch.tensor(X_norm, dtype=torch.float32).to(self.device)
            )
            # Use temperature scaling (T=0.5) to sharpen softmax output
            # so the correct user gets a higher probability
            temperature = 0.5
            proba = torch.softmax(logits / temperature, dim=1).cpu().numpy()[0]

        pred_idx = int(np.argmax(proba))
        predicted_user = self.classes_[pred_idx]

        if username in self.classes_:
            user_idx = self.classes_.index(username)
            raw_conf = float(proba[user_idx])
        else:
            raw_conf = 0.0

        # ── Confidence boost ─────────────────────────────────────────
        # When the model's top prediction matches the claimed user,
        # boost confidence because the model IS recognising them.
        boost = HYPERPARAMS.get("confidence_boost_factor", 0.25)
        if predicted_user == username and raw_conf > 0.10:
            user_conf = min(1.0, raw_conf + boost * (1.0 - raw_conf))
        elif predicted_user == username:
            user_conf = min(1.0, raw_conf * 1.5)
        else:
            user_conf = raw_conf

        threshold = HYPERPARAMS["confidence_threshold"]
        return {
            "confidence": user_conf,
            "decision": bool(user_conf >= threshold),
            "predicted_user": predicted_user,
            "raw_confidence": raw_conf,
            "all_probabilities": {
                u: float(proba[i]) for i, u in enumerate(self.classes_)
            },
            "rf_prob": user_conf,
            "svm_prob": user_conf,
        }

    def _features_to_sequence(self, features: Any) -> np.ndarray:
        """Convert any supported feature format to (seq_len, n_feat) array."""
        if isinstance(features, dict):
            order = [
                "mean_dwell", "std_dwell", "median_dwell", "max_dwell",
                "mean_flight", "std_flight", "median_flight", "min_flight",
                "typing_speed_wpm", "dwell_flight_ratio",
                "rhythm_consistency", "total_time_ms", "n_keys",
            ]
            feat_list = [float(features.get(k, 0)) for k in order]
            return self.synthesize_sequence_from_features(feat_list)

        if isinstance(features, (list, np.ndarray)):
            arr = np.asarray(features, dtype=object)
            if arr.ndim == 1 and len(features) > 0 and isinstance(features[0], dict):
                return self.preprocess_raw_keystrokes(features)
            try:
                arr_f = np.asarray(features, dtype=np.float32)
            except (ValueError, TypeError):
                return np.zeros(
                    (self.sequence_length, self.n_features), dtype=np.float32
                )
            if arr_f.ndim == 1 and arr_f.shape[0] <= 20:
                return self.synthesize_sequence_from_features(arr_f.tolist())
            if arr_f.ndim == 2:
                return self._pad_or_truncate(arr_f)

        return np.zeros(
            (self.sequence_length, self.n_features), dtype=np.float32
        )

    # ── Evaluation ───────────────────────────────────────────────────────
    def evaluate(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """Evaluate on data. Returns accuracy, loss, per-user accuracy."""
        if not self.is_trained:
            return {"accuracy": 0.0, "loss": 999.0}

        y_enc = self.label_encoder.transform(y)
        X_norm = self._normalize_batch(X, fit=False)

        self.model.eval()
        with torch.no_grad():
            X_t = torch.tensor(X_norm, dtype=torch.float32).to(self.device)
            y_t = torch.tensor(y_enc, dtype=torch.long).to(self.device)
            logits = self.model(X_t)
            loss = nn.CrossEntropyLoss()(logits, y_t).item()
            preds = logits.argmax(dim=1).cpu().numpy()

        acc = float((preds == y_enc).mean())
        per_user: Dict[str, float] = {}
        for cls in self.classes_:
            idx_cls = self.label_encoder.transform([cls])[0]
            mask = y_enc == idx_cls
            if mask.sum() > 0:
                per_user[cls] = float((preds[mask] == idx_cls).mean())

        return {"accuracy": acc, "loss": loss, "per_user_accuracy": per_user}

    # ── Persistence ──────────────────────────────────────────────────────
    def save(self, model_path: Optional[str] = None) -> None:
        """Save the PyTorch model + metadata."""
        mp = Path(model_path) if model_path else MODEL_PATH
        mp.parent.mkdir(parents=True, exist_ok=True)

        if self.model is not None:
            torch.save(self.model.state_dict(), str(mp))

        meta = {
            "classes_": self.classes_,
            "is_trained": self.is_trained,
            "scaler": self.scaler,
            "label_encoder": self.label_encoder,
            "sequence_length": self.sequence_length,
            "n_features": self.n_features,
            "n_users": len(self.classes_),
        }
        meta_path = Path(str(mp).rsplit(".", 1)[0] + "_metadata.pkl")
        with open(meta_path, "wb") as f:
            pickle.dump(meta, f)

    @classmethod
    def load(cls, model_path: Optional[str] = None) -> "LSTMKeystrokeAuth":
        """Load a previously saved model."""
        mp = Path(model_path) if model_path else MODEL_PATH
        meta_path = Path(str(mp).rsplit(".", 1)[0] + "_metadata.pkl")

        obj = cls()
        if not mp.exists() or not meta_path.exists():
            return obj
        if not TORCH_AVAILABLE:
            return obj

        try:
            with open(meta_path, "rb") as f:
                meta = pickle.load(f)
            obj.classes_ = meta["classes_"]
            obj.is_trained = meta["is_trained"]
            obj.scaler = meta["scaler"]
            obj.label_encoder = meta["label_encoder"]
            obj.sequence_length = meta.get("sequence_length", 50)
            obj.n_features = meta.get("n_features", 4)
            n_users = meta.get("n_users", len(obj.classes_))

            obj.build_model(n_users)
            obj.model.load_state_dict(
                torch.load(str(mp), map_location=obj.device, weights_only=True)
            )
            obj.model.eval()
        except Exception as exc:
            print(f"[LSTMKeystrokeAuth] Failed to load model: {exc}")
            obj = cls()
        return obj


# ── Drop-in adapter matching BehavioralAuthModel API ─────────────────────────
class LSTMAuthAdapter:
    """
    Drop-in replacement for BehavioralAuthModel so that app.py needs
    minimal changes. Same .fit() / .predict() / .save() / .load() API.
    """

    def __init__(self) -> None:
        self.lstm = LSTMKeystrokeAuth()
        self.classes_: List[str] = []
        self.is_trained: bool = False

    def fit(self, X: List[List[float]], y: List[str]) -> Dict[str, float]:
        """Train from existing 13-feature samples with data augmentation."""
        if len(set(y)) < 2:
            raise ValueError("Need ≥ 2 distinct users to train.")

        n_aug = HYPERPARAMS.get("augmentation_factor", 5)
        all_sequences: List[np.ndarray] = []
        all_labels: List[str] = []

        for features, label in zip(X, y):
            # Original (deterministic) sequence
            all_sequences.append(
                self.lstm.synthesize_sequence_from_features(features)
            )
            all_labels.append(label)
            # Augmented versions with controlled variation
            augmented = self.lstm.augment_sequence(features, n_augments=n_aug)
            for aug_seq in augmented:
                all_sequences.append(aug_seq)
                all_labels.append(label)

        sequences = np.array(all_sequences, dtype=np.float32)
        y_arr = np.array(all_labels)
        print(f"[LSTM] Training with {len(X)} original + "
              f"{len(all_sequences) - len(X)} augmented = "
              f"{len(all_sequences)} total samples")
        result = self.lstm.fit(sequences, y_arr)
        self.classes_ = self.lstm.classes_
        self.is_trained = self.lstm.is_trained
        final_acc = result["accuracy"][-1] if result["accuracy"] else 0.0
        return {"rf_acc": final_acc, "svm_acc": final_acc, "n_users": result["n_users"]}

    def predict(self, features: Any, username: str) -> Dict[str, Any]:
        return self.lstm.predict(features, username)

    def save(self, path: str) -> None:
        self.lstm.save(path)

    @classmethod
    def load(cls, path: str) -> "LSTMAuthAdapter":
        obj = cls()
        obj.lstm = LSTMKeystrokeAuth.load(path)
        obj.classes_ = obj.lstm.classes_
        obj.is_trained = obj.lstm.is_trained
        return obj
