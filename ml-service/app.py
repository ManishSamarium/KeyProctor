from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os

from lstm_model import LSTMAuthAdapter
from ml_model import BehavioralAuthModel
from compiler import CppCompiler, grade_submission

app = FastAPI()

LSTM_PATH = "models/lstm_behavioral_auth.pt"
RF_PATH   = "models/behavioral_auth_model.pkl"

compiler = CppCompiler(prefer_local=True)

def load_model():
    if os.path.exists(LSTM_PATH):
        try:
            m = LSTMAuthAdapter.load(LSTM_PATH)
            if m.is_trained: return m
        except Exception as e:
            print(f"Error loading LSTM: {e}")
            
    if os.path.exists(RF_PATH):
        return BehavioralAuthModel.load(RF_PATH)
    
    return BehavioralAuthModel()

class PredictRequest(BaseModel):
    features: list
    username: str

class EnrollRequest(BaseModel):
    username: str
    features: list

class TrainRequest(BaseModel):
    users_data: List[Dict[str, Any]]

class CompileRequest(BaseModel):
    code: str
    stdin: str = ""
    timeout: int = 5

class GradeRequest(BaseModel):
    code: str
    test_cases: List[Dict[str, Any]]
    time_limit: int = 5

@app.post("/predict")
def predict(req: PredictRequest):
    model = load_model()
    try:
        res = model.predict(req.features, req.username)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/retrain")
def retrain(req: TrainRequest):
    X = []
    y = []
    for user_data in req.users_data:
        username = user_data["username"]
        for sample in user_data["features"]:
            X.append(sample)
            y.append(username)
            
    if len(set(y)) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 distinct users to train.")

    rf_model = BehavioralAuthModel()
    metrics = rf_model.fit(X, y)
    rf_model.save(RF_PATH)
    
    try:
        lstm = LSTMAuthAdapter()
        lstm_metrics = lstm.fit(X, y)
        lstm.save(LSTM_PATH)
        return {"status": "success", "metrics": lstm_metrics, "model": "lstm"}
    except Exception as e:
        print(f"[LSTM] Training failed: {e}")
        return {"status": "success", "metrics": metrics, "model": "rf_fallback"}

@app.post("/compile")
def compile_code(req: CompileRequest):
    try:
        result = compiler.compile_and_run(req.code, stdin=req.stdin, timeout=req.timeout)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/grade")
def grade_code(req: GradeRequest):
    try:
        result = grade_submission(compiler, req.code, req.test_cases, time_limit=req.time_limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "engines": compiler.available_engines()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
