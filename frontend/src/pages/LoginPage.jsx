import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess } from '../authSlice';
import { useKeystrokeDynamics } from '../hooks/useKeystrokeDynamics';
import api from '../api';

const PHRASE = 'the quick brown fox jumps over the lazy dog';
const ENROLL_TARGET = 10;
const VERIFY_CONFIDENCE_THRESHOLD = 0.20;

export default function LoginPage() {
  const [stage, setStage] = useState('role'); // role | form | verify | enroll
  const [role, setRole] = useState('');
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', enrollmentNo: '', courseName: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingToken, setPendingToken] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        username: form.username, password: form.password, role
      });
      // Students always go to verification (if enrolled with samples)
      if (role === 'student' && data.user.enrolled) {
        setPendingUser(data);
        setPendingToken(data.accessToken);
        setStage('verify');
      } else if (role === 'student' && !data.user.enrolled) {
        // Not enrolled yet — go to sample collection
        setPendingUser(data);
        setPendingToken(data.accessToken);
        // Temporarily login so api calls work for enroll-sample
        dispatch(loginSuccess(data));
        setStage('enroll');
      } else {
        dispatch(loginSuccess(data));
        navigate('/faculty');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        username: form.username, password: form.password,
        fullName: form.fullName, role,
        courseName: form.courseName, enrollmentNo: form.enrollmentNo
      });
      // Auto-login and go to sample collection for students
      if (role === 'student') {
        setPendingUser(data);
        setPendingToken(data.accessToken);
        dispatch(loginSuccess(data));
        setStage('enroll');
      } else {
        // Faculty — just go to login
        setTab('login');
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  const handleVerifySuccess = () => {
    dispatch(loginSuccess(pendingUser));
    navigate('/student');
  };

  const handleEnrollComplete = () => {
    // Already logged in via dispatch above, just navigate
    navigate('/student');
  };

  // ─── ROLE SELECTION ──────────
  if (stage === 'role') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <div className="absolute w-[420px] h-[420px] rounded-full bg-indigo-500 opacity-30 blur-[80px] -top-30 -left-30 animate-pulse" />
        <div className="absolute w-[360px] h-[360px] rounded-full bg-pink-500 opacity-30 blur-[80px] -bottom-30 -right-30 animate-pulse" style={{animationDelay:'1s'}} />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-cyan-500 opacity-25 blur-[80px] top-1/2 right-1/5 animate-pulse" style={{animationDelay:'2s'}} />

        <div className="relative z-10 w-full max-w-md mx-4 backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
            <span className="text-white text-2xl font-extrabold tracking-tight">TypeProctor</span>
          </div>
          <p className="text-white/50 text-sm mb-8">Behavioural exam integrity — powered by keystroke dynamics</p>
          <h3 className="text-white text-lg font-semibold mb-4">Choose your role</h3>
          <button onClick={() => { setRole('student'); setStage('form'); }}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all mb-3 cursor-pointer">
            🎓 Continue as Student
          </button>
          <button onClick={() => { setRole('faculty'); setStage('form'); }}
            className="w-full py-3.5 rounded-xl font-semibold text-white border border-white/20 hover:bg-white/5 transition-all cursor-pointer">
            👨‍🏫 Continue as Faculty
          </button>
          <p className="text-white/40 text-xs text-center mt-5">First time? Register after selecting your role</p>
        </div>
      </div>
    );
  }

  // ─── BEHAVIORAL ENROLLMENT (sample collection) ──────────
  if (stage === 'enroll') {
    return <EnrollSamples token={pendingToken} onComplete={handleEnrollComplete} />;
  }

  // ─── VERIFY BEHAVIOR ──────────
  if (stage === 'verify') {
    return <VerifyBehavior phrase={PHRASE} token={pendingToken} onSuccess={handleVerifySuccess} onBack={() => setStage('form')} />;
  }

  // ─── LOGIN / REGISTER FORM ──────────
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      <div className="absolute w-[420px] h-[420px] rounded-full bg-indigo-500 opacity-30 blur-[80px] -top-30 -left-30 animate-pulse" />
      <div className="absolute w-[360px] h-[360px] rounded-full bg-pink-500 opacity-30 blur-[80px] -bottom-30 -right-30 animate-pulse" />

      <div className="relative z-10 w-full max-w-md mx-4 backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          <span className="text-white text-2xl font-extrabold">TypeProctor</span>
        </div>
        <p className="text-white/50 text-sm mb-6">Behavioural exam integrity</p>

        <h3 className="text-white text-lg font-semibold mb-4">
          {tab === 'login' ? 'Sign in' : 'Create account'} as <span className="text-indigo-300 capitalize">{role}</span>
        </h3>

        {error && <div className="text-red-300 text-sm mb-3 bg-red-500/10 p-2 rounded-lg">{error}</div>}

        <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-3">
          {tab === 'register' && (
            <input type="text" placeholder="Full Name" value={form.fullName}
              onChange={e => setForm({...form, fullName: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          )}
          <input type="text" placeholder="Username" value={form.username}
            onChange={e => setForm({...form, username: e.target.value})}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          {tab === 'register' && role === 'student' && (
            <input type="text" placeholder="Enrollment Number" value={form.enrollmentNo}
              onChange={e => setForm({...form, enrollmentNo: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          )}
          {tab === 'register' && role === 'faculty' && (
            <input type="text" placeholder="Course Name (e.g. CS301)" value={form.courseName}
              onChange={e => setForm({...form, courseName: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          )}
          <input type="password" placeholder="Password" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          {tab === 'register' && (
            <input type="password" placeholder="Confirm Password" value={form.confirm}
              onChange={e => setForm({...form, confirm: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none transition" />
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all mt-2 cursor-pointer disabled:opacity-50">
            {loading ? 'Please wait...' : tab === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full py-3 mt-3 rounded-xl text-white/70 border border-white/15 hover:bg-white/5 transition text-sm cursor-pointer">
          {tab === 'login' ? "Don't have an account? Register" : 'Already registered? Login'}
        </button>
        <p className="text-white/40 text-xs text-center mt-4 cursor-pointer hover:text-white/60" onClick={() => { setStage('role'); setRole(''); }}>
          ← Change role
        </p>
      </div>
    </div>
  );
}

// ─── ENROLLMENT SAMPLE COLLECTION ──────────
// Shown right after registration — student types phrase 10 times
function EnrollSamples({ token, onComplete }) {
  const [input, setInput] = useState('');
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState('');
  const { onKeyDown, onKeyUp, extractFeatures, reset } = useKeystrokeDynamics();

  const handleSubmit = async () => {
    if (input.trim().toLowerCase() !== PHRASE.toLowerCase()) {
      setMsg('Type the exact phrase correctly'); return;
    }
    const features = extractFeatures();
    if (features.n_keys < 15) { setMsg('Type the full phrase'); return; }
    setMsg('Saving...');
    try {
      const { data } = await api.post('/auth/enroll-sample', { features });
      setCount(data.count);
      setInput('');
      reset();
      if (data.count >= ENROLL_TARGET) {
        setMsg('✅ Enrollment complete! Redirecting...');
        setTimeout(() => onComplete(), 1000);
      } else {
        setMsg(`✓ Sample ${data.count}/${ENROLL_TARGET} saved`);
      }
    } catch {
      setMsg('Error saving sample');
    }
  };

  const progress = (count / ENROLL_TARGET) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      <div className="absolute w-[420px] h-[420px] rounded-full bg-indigo-500 opacity-30 blur-[80px] -top-30 -left-30 animate-pulse" />
      <div className="absolute w-[360px] h-[360px] rounded-full bg-pink-500 opacity-30 blur-[80px] -bottom-30 -right-30 animate-pulse" />

      <div className="relative z-10 w-full max-w-lg mx-4 backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          <span className="text-white text-2xl font-extrabold">TypeProctor</span>
        </div>

        <h2 className="text-white text-xl font-bold mb-1 mt-4">⌨️ Behavioral Enrollment</h2>
        <p className="text-white/50 text-sm mb-4">Type the phrase below <b className="text-white">{ENROLL_TARGET} times</b> to train your unique typing profile. This will be used to verify your identity during exams and labs.</p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/50">Progress</span>
            <span className="text-indigo-300 font-semibold">{count}/{ENROLL_TARGET}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-indigo-500/15 border border-indigo-500/30 rounded-xl p-3.5 text-center text-indigo-200 text-lg font-semibold tracking-wide mb-4">
          {PHRASE}
        </div>

        {msg && <p className={`text-sm mb-3 ${msg.startsWith('✓') || msg.startsWith('✅') ? 'text-green-300' : 'text-amber-300'}`}>{msg}</p>}

        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown} onKeyUp={onKeyUp}
          onKeyPress={e => { if(e.key === 'Enter') handleSubmit(); }}
          placeholder="Type the phrase here..." autoFocus
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.08] border border-indigo-500/40 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none mb-3 text-lg" />

        <button onClick={handleSubmit}
          className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 cursor-pointer hover:shadow-lg transition">
          Submit Sample ({count + 1}/{ENROLL_TARGET})
        </button>

        <p className="text-white/30 text-xs text-center mt-4">Type naturally — your rhythm, speed, and key patterns are being captured</p>
      </div>
    </div>
  );
}

// ─── BEHAVIORAL VERIFICATION COMPONENT ──────────
// Shown every login for enrolled students — type phrase once
function VerifyBehavior({ phrase, token, onSuccess, onBack }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [buffer, setBuffer] = useState([]);

  const handleKeyDown = (e) => {
    setBuffer(prev => [...prev, { key: e.key, type: 'down', t: Date.now() }]);
  };
  const handleKeyUp = (e) => {
    setBuffer(prev => [...prev, { key: e.key, type: 'up', t: Date.now() }]);
  };

  const extractFeatures = (buf) => {
    const events = buf.filter(e => e.key.length === 1 || e.key === 'Backspace' || e.key === ' ');
    const downTimes = {}; const dwells = []; const flights = [];
    let firstDown = null, lastUp = null, prevUp = null;
    for (const e of events) {
      if (e.type === 'down') {
        downTimes[`k_${e.t}`] = e.t;
        if (!firstDown) firstDown = e.t;
        if (prevUp !== null) flights.push(e.t - prevUp);
      } else {
        const keys = Object.keys(downTimes);
        if (keys.length > 0) { const last = keys[keys.length-1]; dwells.push(e.t - downTimes[last]); delete downTimes[last]; }
        prevUp = e.t; lastUp = e.t;
      }
    }
    const mean = a => a.length ? a.reduce((s,v) => s+v, 0) / a.length : 0;
    const std = a => { const m = mean(a); return a.length ? Math.sqrt(a.reduce((s,v) => s+Math.pow(v-m,2), 0)/a.length) : 0; };
    const median = a => { if (!a.length) return 0; const s = [...a].sort((x,y)=>x-y); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
    const pf = flights.filter(f => f >= 0);
    const tt = firstDown && lastUp ? lastUp - firstDown : 1000;
    const md = mean(dwells), mf = mean(pf);
    return { mean_dwell: md, std_dwell: std(dwells), median_dwell: median(dwells), max_dwell: dwells.length ? Math.max(...dwells) : 0,
      mean_flight: mf, std_flight: std(pf), median_flight: median(pf), min_flight: pf.length ? Math.min(...pf) : 0,
      typing_speed_wpm: tt > 0 ? (events.length/5)/(tt/60000) : 0, dwell_flight_ratio: mf > 0 ? md/mf : 1,
      rhythm_consistency: md > 0 ? Math.max(0, Math.min(1, 1-(std(dwells)/md))) : 0, total_time_ms: tt, n_keys: events.length };
  };

  const doVerify = async () => {
    if (input.trim().toLowerCase() !== phrase.toLowerCase()) {
      setStatus('Please type the exact phrase'); return;
    }
    const features = extractFeatures(buffer);
    if (features.n_keys < 15) { setStatus('Type the full phrase first'); return; }
    setStatus('Verifying...');
    try {
      const { data } = await api.post('/auth/verify-behavior', { features }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.confidence >= VERIFY_CONFIDENCE_THRESHOLD || data.decision) {
        onSuccess();
      } else {
        setAttempts(a => a + 1);
        setStatus(`Confidence ${(data.confidence*100).toFixed(0)}% — needs ≥${VERIFY_CONFIDENCE_THRESHOLD*100}%. ${2-attempts} attempts left.`);
        setInput(''); setBuffer([]);
      }
    } catch { setStatus('Verification error'); }
  };

  if (attempts >= 3) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)'}}>
        <div className="text-center text-white p-10">
          <p className="text-5xl mb-4">🚫</p>
          <p className="text-red-300 text-lg font-semibold">Verification failed after 3 attempts</p>
          <p className="text-white/50 text-sm mt-2 mb-6">Your typing pattern didn't match. Contact your faculty for help.</p>
          <button onClick={onBack} className="px-6 py-2 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 cursor-pointer">← Try different account</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)'}}>
      <div className="w-full max-w-md mx-4 backdrop-blur-xl bg-white/[0.07] border border-white/12 rounded-3xl p-10 shadow-2xl">
        <p className="text-white text-lg font-bold mb-1">🔐 Verify your identity</p>
        <p className="text-white/50 text-sm mb-4">Type the phrase below to confirm your typing pattern matches your profile</p>
        <div className="bg-indigo-500/15 border border-indigo-500/30 rounded-xl p-3.5 text-center text-indigo-200 text-lg font-semibold tracking-wide mb-4">{phrase}</div>
        {status && <p className="text-amber-300 text-sm mb-3">{status}</p>}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}
          onKeyPress={e => { if(e.key === 'Enter') doVerify(); }}
          placeholder="Type the phrase here..." autoFocus
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.08] border border-indigo-500/40 text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none mb-3" />
        <button onClick={doVerify} className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 cursor-pointer">Verify Identity</button>
        <button onClick={onBack} className="w-full py-2 mt-3 text-white/50 text-sm hover:text-white/70 cursor-pointer">← Back to login</button>
      </div>
    </div>
  );
}
