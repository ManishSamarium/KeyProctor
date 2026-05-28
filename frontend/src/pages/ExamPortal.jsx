import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useKeystrokeDynamics } from '../hooks/useKeystrokeDynamics';
import { useCopyPasteBlock } from '../hooks/useCopyPasteBlock';
import api, { API_URL } from '../api';
import { io } from 'socket.io-client';

export default function ExamPortal() {
  const { id } = useParams();
  const { user, token } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [authLog, setAuthLog] = useState([]);
  const [cpLog, setCpLog] = useState([]);
  const [confidence, setConfidence] = useState(1.0);
  const [authStatus, setAuthStatus] = useState('Verified');
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { onKeyDown, onKeyUp, extractFeatures, reset } = useKeystrokeDynamics();
  const socketRef = useRef(null);
  const sessionId = useRef(`exam_${id}_${Date.now()}`);
  const checkIntervalRef = useRef(null);

  const handleCpBlockEvent = useCallback((evt) => {
    setCpLog(prev => [...prev, { ...evt, questionId: 'global', chars: 0 }]);
    socketRef.current?.emit('cp:event', { sessionId: sessionId.current, eventType: evt.eventType, questionId: 'global', chars: 0 });
  }, []);
  useCopyPasteBlock(handleCpBlockEvent);

  // Load exam
  useEffect(() => {
    api.get(`/exams/${id}`).then(r => {
      setExam(r.data);
      setTimeLeft(r.data.durationMins * 60);
    }).catch(() => navigate('/student'));
  }, [id]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { handleSubmit(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timeLeft, submitted]);

  // Socket.IO for real-time auth
  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('auth:result', (data) => {
      setConfidence(data.confidence);
      setAuthStatus(data.status);
      setAuthLog(prev => [...prev, { confidence: data.confidence, status: data.status, timestamp: Date.now() }]);
    });

    // Send auth checks every 30 seconds
    checkIntervalRef.current = setInterval(() => {
      const features = extractFeatures();
      if (features.n_keys > 5) {
        socket.emit('auth:check', { features, sessionId: sessionId.current, examId: id });
      }
    }, 30000);

    return () => {
      clearInterval(checkIntervalRef.current);
      socket.disconnect();
    };
  }, [token, id]);

  // Block paste
  const handlePaste = (e, qId) => {
    e.preventDefault();
    setCpLog(prev => [...prev, { eventType: 'paste', questionId: qId, chars: 0, timestamp: Date.now() }]);
    socketRef.current?.emit('cp:event', { sessionId: sessionId.current, eventType: 'paste', questionId: qId, chars: 0 });
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    try {
      const { data } = await api.post(`/exams/${id}/submit`, {
        sessionId: sessionId.current, answers, authLog, cpLog
      });
      alert(`Exam submitted!\nIntegrity: ${data.integrity.grade} (${data.integrity.integrityScore.toFixed(0)}%)`);
      navigate('/student');
    } catch {
      alert('Failed to submit exam');
      setSubmitted(false);
    }
  };

  if (!exam) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading exam...</div>;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-indigo-300';
  const dotColor = authStatus === 'Verified' ? 'bg-green-400' : authStatus === 'Warning' ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg">
        <span className="text-white font-semibold">{exam.title}</span>
        <span className={`font-mono text-xl font-bold ${timerColor}`}>{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</span>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />
          <span className="text-slate-400 text-sm">Monitoring active</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Questions panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {exam.instructions && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 text-indigo-800 text-sm">{exam.instructions}</div>
          )}
          {exam.questions?.map((q, i) => (
            <div key={q.questionId} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-4">
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-slate-800">Q{i+1}.</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{q.marks} marks</span>
              </div>
              <p className="text-slate-700 mb-3">{q.text}</p>
              <textarea
                value={answers[q.questionId] || ''}
                onChange={e => setAnswers(prev => ({...prev, [q.questionId]: e.target.value}))}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onPaste={e => handlePaste(e, q.questionId)}
                rows={5}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-none text-sm"
              />
            </div>
          ))}
          <button onClick={handleSubmit} disabled={submitted}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg transition cursor-pointer disabled:opacity-50 mt-2">
            {submitted ? 'Submitted' : 'Submit Exam'}
          </button>
        </div>

        {/* Auth panel */}
        <div className="w-80 bg-white border-l border-slate-200 p-5 overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-4">🛡️ Auth Monitor</h3>
          {/* Confidence gauge */}
          <div className="text-center mb-5">
            <div className="relative w-32 h-32 mx-auto">
              <svg viewBox="0 0 36 36" className="w-32 h-32">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={confidence >= 0.5 ? '#22c55e' : confidence >= 0.25 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3" strokeDasharray={`${confidence * 100}, 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-800">{(confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">Confidence Score</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-3 py-1 rounded-full ${authStatus === 'Verified' ? 'bg-green-100 text-green-700' : authStatus === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {authStatus}
            </span>
          </div>

          <h4 className="font-semibold text-slate-700 text-sm mb-2">Activity Log</h4>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {authLog.slice(-10).reverse().map((log, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                <span className={`font-medium ${log.status === 'Verified' ? 'text-green-600' : log.status === 'Warning' ? 'text-amber-600' : 'text-red-600'}`}>{log.status}</span>
                <span className="text-slate-400">{(log.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
            {authLog.length === 0 && <p className="text-slate-400 text-xs">Waiting for first check...</p>}
          </div>

          {cpLog.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-red-600 text-sm mb-2">⚠️ Paste Events ({cpLog.length})</h4>
              {cpLog.map((cp, i) => (
                <div key={i} className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-1">Paste detected on {cp.questionId}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
