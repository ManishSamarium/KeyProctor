# KeyProctor — Behavioural Exam Integrity System

A full-stack MERN application for exam and lab proctoring using **keystroke dynamics** and **behavioural biometrics**. KeyProctor verifies student identity through their unique typing patterns using dual ML models (LSTM + Random Forest/SVM ensemble).

## 🏗️ Architecture

```
KeyProctor/
├── frontend/       # React 19 + Vite + Tailwind CSS 4
├── backend/        # Node.js + Express 5 + MongoDB + Socket.IO
└── ml-service/     # Python FastAPI + PyTorch LSTM + scikit-learn
```

| Service | Tech Stack | Port | Deploy To |
|---------|-----------|------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Redux Toolkit, Monaco Editor | 5173 | Vercel |
| **Backend** | Express 5, Mongoose 9, Socket.IO, JWT, bcrypt | 5001 | Render |
| **ML Service** | FastAPI, PyTorch, scikit-learn, LSTM + RF/SVM | 8001 | Render |

## ✨ Features

### Core
- 🔐 **Behavioral Authentication** — Keystroke dynamics (13-feature extraction: dwell time, flight time, rhythm, WPM, etc.)
- 🧠 **Dual ML Models** — LSTM deep learning + Random Forest/SVM ensemble with automatic fallback
- 🔄 **Auto-retraining** — Models retrain when sufficient enrollment data is collected

### Exam System
- 📝 Faculty creates exams with dynamic questions
- ⏱️ Timed exam sessions with auto-submit
- 🛡️ Real-time behavioral monitoring (30-second auth checks via Socket.IO)
- 🚫 Copy/paste/cut/drop blocking with toast notifications
- 📊 Integrity scoring (behavioral + paste penalty composite)

### Lab System
- 💻 Monaco-powered C++ code editor with syntax highlighting
- ▶️ Code compilation with 3-engine fallback (local g++ → Piston → Judge0)
- ✅ Automated test-case grading with per-test results
- 🔒 Same copy-paste restrictions and behavioral auth as exams

### User Flows
- 🎓 **Students**: Register → Collect 10 typing samples → Browse & enroll in courses → Take exams/labs
- 👨‍🏫 **Faculty**: Register with course → Create exams/labs → Monitor students live → Review submissions
- 🔑 **Login**: Password → Type phrase once for behavioral verification (20% confidence threshold)

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- g++ (optional, for local C++ compilation)

### Setup

```bash
# 1. Clone
git clone https://github.com/ManishSamarium/KeyProctor.git
cd KeyProctor

# 2. Backend
cd backend
cp .env.example .env    # Edit with your MongoDB URI
npm install
npm start               # http://localhost:5001

# 3. ML Service
cd ../ml-service
pip install -r requirements.txt
python app.py           # http://localhost:8001

# 4. Frontend
cd ../frontend
npm install
npm run dev             # http://localhost:5173
```

### Environment Variables

**backend/.env**
```env
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/typeproctor
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
ML_SERVICE_URL=http://localhost:8001
CLIENT_URL=http://localhost:5173
```

**frontend/.env** (optional)
```env
VITE_API_URL=http://localhost:5001
```

## ☁️ Deployment

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Set **Framework Preset** to `Vite`
4. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (e.g. `https://keyproctor-backend.onrender.com`)
5. Deploy

### Backend → Render (Web Service)

1. Create **Web Service** on [render.com](https://render.com)
2. Connect your repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add environment variables:
   - `PORT` = `5001`
   - `MONGO_URI` = your MongoDB Atlas connection string
   - `JWT_SECRET` = a strong secret
   - `JWT_REFRESH_SECRET` = another strong secret
   - `ML_SERVICE_URL` = your Render ML service URL
   - `CLIENT_URL` = your Vercel frontend URL

### ML Service → Render (Web Service)

1. Create another **Web Service** on [render.com](https://render.com)
2. Settings:
   - **Root Directory**: `ml-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
3. No additional env vars needed (optional: `JUDGE0_API_KEY` for Judge0 compiler)

### MongoDB → Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Whitelist `0.0.0.0/0` for Render access
3. Copy the connection string to `MONGO_URI`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── pages/          # LoginPage, StudentDashboard, ExamPortal, LabPortal, FacultyDashboard, LabManage
│   ├── hooks/          # useKeystrokeDynamics, useCopyPasteBlock, useAuthMonitor
│   ├── api.js          # Axios instance with JWT interceptor
│   ├── store.js        # Redux store
│   ├── authSlice.js    # Auth state management
│   └── App.jsx         # Router + protected routes

backend/
├── models/             # User, Exam, Submission, Lab, LabSubmission, Enrollment, AuthLog, CopyPasteLog
├── routes/             # auth, exam, lab, faculty routes
├── services/           # ML service connector
├── socket/             # Socket.IO real-time monitoring
├── middleware/          # JWT auth + role-based access
└── server.js           # Express app entry point

ml-service/
├── app.py              # FastAPI endpoints (predict, retrain, compile, grade)
├── compiler.py         # C++ compiler with 3-engine fallback
├── ml_model.py         # Random Forest + SVM ensemble
├── lstm_model.py       # LSTM deep learning model
└── models/             # Trained model weights
```

## 🧪 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Password authentication |
| POST | `/api/auth/verify-behavior` | Behavioral verification |
| POST | `/api/auth/enroll-sample` | Submit keystroke sample |
| GET | `/api/auth/courses` | List all available courses |
| POST | `/api/auth/enroll-course` | Enroll in a course |
| GET | `/api/auth/my-enrollments` | Student's enrolled courses |

### Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exams` | Create exam (faculty) |
| GET | `/api/exams` | List exams |
| POST | `/api/exams/:id/submit` | Submit exam |

### Labs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/labs` | Create lab (faculty) |
| POST | `/api/labs/:id/run` | Compile & run code |
| POST | `/api/labs/:id/submit` | Submit for grading |

### ML Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Behavioral prediction |
| POST | `/retrain` | Retrain models |
| POST | `/compile` | Compile C++ code |
| POST | `/grade` | Grade against test cases |

## 📄 License

MIT
