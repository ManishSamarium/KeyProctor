import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../authSlice';
import api, { API_URL } from '../api';
import { io } from 'socket.io-client';
import LabManage from './LabManage';

export default function FacultyDashboard() {
  const { user, token } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [liveStudents, setLiveStudents] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [examForm, setExamForm] = useState({ title: '', subject: '', date: '', durationMins: 60, instructions: '', questions: [{ text: '', marks: 10 }] });
  const [enrollInput, setEnrollInput] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    api.get('/faculty/overview').then(r => setOverview(r.data)).catch(() => {});
    api.get('/exams').then(r => setExams(r.data)).catch(() => {});
  }, []);

  // Socket.IO for live monitoring
  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('student:auth-update', (data) => {
      setLiveStudents(prev => ({
        ...prev,
        [data.username]: { ...data, lastUpdate: Date.now() }
      }));
      if (data.status === 'Flagged') {
        setAlerts(prev => [{ ...data, type: 'auth' }, ...prev.slice(0, 20)]);
      }
    });

    socket.on('student:cp-alert', (data) => {
      setAlerts(prev => [{ ...data, type: 'paste' }, ...prev.slice(0, 20)]);
    });

    return () => socket.disconnect();
  }, [token]);

  const handleCreateExam = async () => {
    try {
      const payload = {
        ...examForm,
        durationMins: parseInt(examForm.durationMins),
        questions: examForm.questions.map((q, i) => ({
          questionId: `q_${i+1}`, text: q.text, marks: parseInt(q.marks) || 10, type: 'text'
        }))
      };
      await api.post('/exams', payload);
      setShowCreateExam(false);
      api.get('/exams').then(r => setExams(r.data));
      setExamForm({ title: '', subject: '', date: '', durationMins: 60, instructions: '', questions: [{ text: '', marks: 10 }] });
    } catch { alert('Failed to create exam'); }
  };

  const handleEnrollStudent = async () => {
    try {
      await api.post('/faculty/enroll-student', { studentUsername: enrollInput });
      setEnrollInput('');
      api.get('/faculty/overview').then(r => setOverview(r.data));
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const navItems = [
    { id: 'overview', label: '📊  Overview' },
    { id: 'exams', label: '📝  Exams' },
    { id: 'labs', label: '🔬  Labs' },
    { id: 'monitoring', label: '🔴  Live Monitor' },
    { id: 'students', label: '👥  Students' },
  ];

  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').toUpperCase() || 'F';

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <div className="w-60 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
            <span className="font-extrabold text-base">TypeProctor</span>
          </div>
          <p className="text-white text-sm font-medium mt-3">{user?.fullName}</p>
          <span className="inline-block bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full mt-1">{user?.courseName}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition cursor-pointer ${tab === item.id ? 'bg-indigo-500/15 text-indigo-300 border-l-3 border-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={() => { dispatch(logout()); navigate('/'); }}
            className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition cursor-pointer">
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {tab === 'overview' && <OverviewTab overview={overview} alerts={alerts} />}
        {tab === 'exams' && <ExamsTab exams={exams} showCreate={showCreateExam} setShowCreate={setShowCreateExam} form={examForm} setForm={setExamForm} onCreate={handleCreateExam} />}
        {tab === 'labs' && <LabManage />}
        {tab === 'monitoring' && <MonitoringTab liveStudents={liveStudents} alerts={alerts} />}
        {tab === 'students' && <StudentsTab overview={overview} enrollInput={enrollInput} setEnrollInput={setEnrollInput} onEnroll={handleEnrollStudent} />}
      </div>
    </div>
  );
}

function OverviewTab({ overview, alerts }) {
  if (!overview) return <p className="text-slate-500">Loading...</p>;
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">Dashboard</h1>
      <p className="text-slate-500 text-sm mb-6">Real-time overview of your course</p>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Students', value: overview.totalStudents, icon: '👥', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Exams', value: overview.totalExams, icon: '📝', color: 'bg-purple-50 text-purple-600' },
          { label: 'Submissions', value: overview.totalSubmissions, icon: '📄', color: 'bg-green-50 text-green-600' },
          { label: 'Flagged', value: overview.flaggedCount, icon: '🚩', color: 'bg-red-50 text-red-600' },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">{m.label}</span>
              <span className={`w-9 h-9 rounded-lg ${m.color} flex items-center justify-center text-lg`}>{m.icon}</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-800">{m.value}</p>
          </div>
        ))}
      </div>
      {/* Recent alerts */}
      <h2 className="text-lg font-bold text-slate-800 mb-3">Recent Alerts</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        {alerts.length === 0 ? <p className="text-slate-400 text-sm">No alerts yet</p> : (
          <div className="space-y-2">
            {alerts.slice(0, 8).map((a, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${a.type === 'paste' ? 'bg-red-50' : a.status === 'Flagged' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <span className="font-medium text-slate-700">{a.username} {a.fullName && `(${a.fullName})`}</span>
                <span className={`font-semibold ${a.type === 'paste' ? 'text-red-600' : 'text-amber-600'}`}>
                  {a.type === 'paste' ? '📋 Paste detected' : `⚠️ ${a.status} (${(a.confidence*100).toFixed(0)}%)`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExamsTab({ exams, showCreate, setShowCreate, form, setForm, onCreate }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Exams</h1>
          <p className="text-slate-500 text-sm">Create and manage your exams</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition">
          + Create Exam
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">New Exam</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            <input placeholder="Subject" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            <input type="number" placeholder="Duration (mins)" value={form.durationMins} onChange={e => setForm({...form, durationMins: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
          </div>
          <textarea placeholder="Instructions" value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} rows={2}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none mb-4" />
          <h4 className="font-semibold text-slate-700 mb-2">Questions</h4>
          {form.questions.map((q, i) => (
            <div key={i} className="flex gap-3 mb-2">
              <input placeholder={`Question ${i+1}`} value={q.text} onChange={e => {
                const qs = [...form.questions]; qs[i].text = e.target.value; setForm({...form, questions: qs});
              }} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
              <input type="number" placeholder="Marks" value={q.marks} onChange={e => {
                const qs = [...form.questions]; qs[i].marks = e.target.value; setForm({...form, questions: qs});
              }} className="w-20 px-3 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            </div>
          ))}
          <button onClick={() => setForm({...form, questions: [...form.questions, { text: '', marks: 10 }]})}
            className="text-indigo-600 text-sm font-medium mb-4 cursor-pointer hover:underline">+ Add question</button>
          <div className="flex gap-3 mt-2">
            <button onClick={onCreate} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer">Create Exam</button>
            <button onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {exams.map(e => (
          <div key={e._id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">{e.title}</h3>
              <p className="text-slate-500 text-sm">{e.subject} · {e.date} · {e.durationMins}min · {e.questions?.length} questions</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${e.status === 'active' ? 'bg-green-100 text-green-700' : e.status === 'ended' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-700'}`}>
              {e.status}
            </span>
          </div>
        ))}
        {exams.length === 0 && <p className="text-slate-400 text-sm">No exams created yet</p>}
      </div>
    </div>
  );
}

function MonitoringTab({ liveStudents, alerts }) {
  const students = Object.values(liveStudents).sort((a,b) => a.confidence - b.confidence);
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🔴 Live Monitoring</h1>
      <p className="text-slate-500 text-sm mb-6">Real-time behavioral authentication status</p>

      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-400">No active students yet. Students will appear here when they start an exam.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {students.map((s) => (
            <div key={s.username} className={`bg-white rounded-2xl p-5 border-2 shadow-sm ${s.status === 'Flagged' ? 'border-red-300 bg-red-50' : s.status === 'Warning' ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-800">{s.fullName || s.username}</span>
                <div className={`w-3 h-3 rounded-full animate-pulse ${s.status === 'Verified' ? 'bg-green-400' : s.status === 'Warning' ? 'bg-amber-400' : 'bg-red-500'}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-800">{(s.confidence * 100).toFixed(0)}%</span>
                <span className="text-slate-500 text-sm">confidence</span>
              </div>
              <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${s.status === 'Verified' ? 'bg-green-100 text-green-700' : s.status === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-bold text-slate-800 mb-3">Alert Feed</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 max-h-80 overflow-y-auto">
        {alerts.length === 0 ? <p className="text-slate-400 text-sm">No alerts</p> : (
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm ${a.type === 'paste' ? 'bg-red-50' : 'bg-amber-50'}`}>
                <span className="text-slate-700 font-medium">{a.username}</span>
                <span className={a.type === 'paste' ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                  {a.type === 'paste' ? '📋 Paste' : `⚠️ ${(a.confidence*100).toFixed(0)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentsTab({ overview, enrollInput, setEnrollInput, onEnroll }) {
  const students = overview?.students || [];
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">Students</h1>
      <p className="text-slate-500 text-sm mb-6">Manage enrolled students</p>

      <div className="flex gap-3 mb-6">
        <input value={enrollInput} onChange={e => setEnrollInput(e.target.value)} placeholder="Student username"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:outline-none" />
        <button onClick={onEnroll} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer">Enroll Student</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Username</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Enrollment No</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Behavioral</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Samples</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{s.fullName}</td>
                <td className="px-5 py-3 text-slate-600">{s.username}</td>
                <td className="px-5 py-3 text-slate-600">{s.enrollmentNo || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.enrolled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.enrolled ? 'Enrolled' : 'Pending'}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{s.sampleCount}/10</td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No students enrolled yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
