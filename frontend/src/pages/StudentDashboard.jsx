import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout, updateUser } from '../authSlice';
import api from '../api';

export default function StudentDashboard() {
  const { user } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [labs, setLabs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [enrollMsg, setEnrollMsg] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | courses

  const fetchData = async () => {
    try {
      const [exRes, labRes, courseRes, enrollRes] = await Promise.all([
        api.get('/exams').catch(() => ({ data: [] })),
        api.get('/labs').catch(() => ({ data: [] })),
        api.get('/auth/courses').catch(() => ({ data: [] })),
        api.get('/auth/my-enrollments').catch(() => ({ data: [] }))
      ]);
      setExams(exRes.data);
      setLabs(labRes.data);
      setCourses(courseRes.data);
      setMyEnrollments(enrollRes.data);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const handleEnrollCourse = async (facultyId, courseName) => {
    try {
      const { data } = await api.post('/auth/enroll-course', { facultyId });
      setEnrollMsg(`✅ ${data.message}`);
      fetchData(); // Refresh all data
      setTimeout(() => setEnrollMsg(''), 3000);
    } catch (err) {
      setEnrollMsg(err.response?.data?.error || 'Enrollment failed');
    }
  };

  const isEnrolled = (facultyId) => myEnrollments.some(e => e.facultyId === facultyId);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').toUpperCase() || 'S';

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 px-8 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-2.5">
          <svg className="w-7 h-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          <span className="font-extrabold text-white text-lg">TypeProctor</span>
        </div>
        <span className="text-slate-400 text-sm">{greeting}, <b className="text-white">{user?.fullName?.split(' ')[0]}</b> 👋</span>
        <div className="flex items-center gap-3">
          {user?.enrollmentNo && <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">{user.enrollmentNo}</span>}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold text-sm flex items-center justify-center">{initials}</div>
          <button onClick={() => { dispatch(logout()); navigate('/'); }} className="text-red-400/70 hover:text-red-400 text-sm ml-2 cursor-pointer">Logout</button>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-2 flex gap-2">
        <button onClick={() => setActiveTab('dashboard')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === 'dashboard' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>📊 Dashboard</button>
        <button onClick={() => setActiveTab('courses')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
            activeTab === 'courses' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}>📚 Browse Courses</button>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {enrollMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${enrollMsg.startsWith('✅') ? 'bg-green-500/10 text-green-300 border border-green-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}>
            {enrollMsg}
          </div>
        )}

        {activeTab === 'courses' ? (
          <CoursesTab courses={courses} isEnrolled={isEnrolled} onEnroll={handleEnrollCourse} myEnrollments={myEnrollments} />
        ) : (
          <DashboardTab exams={exams} labs={labs} myEnrollments={myEnrollments} user={user} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ──────────
function DashboardTab({ exams, labs, myEnrollments, user, navigate }) {
  return (
    <>
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Courses Enrolled" value={myEnrollments.length} icon="📚" />
        <MetricCard label="Exams Available" value={exams.length} icon="📝" />
        <MetricCard label="Labs Available" value={labs.length} icon="🔬" />
        <MetricCard label="Auth Status" value={user?.enrolled ? '✓ Active' : 'Pending'} icon="🛡️" />
      </div>

      {/* Enrolled courses */}
      {myEnrollments.length > 0 && (
        <>
          <h2 className="text-white text-xl font-bold mb-4">My Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {myEnrollments.map(e => (
              <div key={e.id} className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4">
                <h3 className="text-white font-bold">{e.courseName}</h3>
                <p className="text-white/40 text-sm">Faculty: {e.facultyName}</p>
                <p className="text-white/30 text-xs mt-1">Since {new Date(e.since).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {myEnrollments.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6">
          <p className="text-amber-200 font-semibold">📚 No courses enrolled yet</p>
          <p className="text-amber-200/60 text-sm mt-1">Go to the "Browse Courses" tab to enroll in available courses and access exams & labs.</p>
        </div>
      )}

      {/* Exams list */}
      <h2 className="text-white text-xl font-bold mb-4">Available Exams</h2>
      {exams.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-white/50">No exams available. Enroll in courses first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map(exam => (
            <div key={exam._id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 hover:shadow-lg transition cursor-pointer"
              onClick={() => navigate(`/exam/${exam._id}`)}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-white font-bold text-lg">{exam.title}</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${exam.status === 'active' ? 'bg-green-500/20 text-green-300' : exam.status === 'ended' ? 'bg-slate-500/20 text-slate-400' : 'bg-indigo-500/20 text-indigo-300'}`}>
                  {exam.status}
                </span>
              </div>
              <p className="text-white/50 text-sm">{exam.subject}</p>
              <div className="flex gap-4 mt-3 text-white/40 text-xs">
                <span>📅 {exam.date}</span>
                <span>⏱️ {exam.durationMins} min</span>
                <span>❓ {exam.questions?.length || 0} questions</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Labs list */}
      <h2 className="text-white text-xl font-bold mb-4 mt-8">Available Labs</h2>
      {labs.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-white/50">No labs available. Enroll in courses first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labs.map(lab => (
            <div key={lab._id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 hover:shadow-lg transition cursor-pointer"
              onClick={() => navigate(`/lab/${lab._id}`)}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-white font-bold text-lg">{lab.title}</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300">Lab</span>
              </div>
              <p className="text-white/50 text-sm">{lab.course || lab.description?.slice(0, 80)}</p>
              <div className="flex gap-4 mt-3 text-white/40 text-xs">
                {lab.deadline && <span>📅 Due: {new Date(lab.deadline).toLocaleDateString()}</span>}
                <span>📄 {lab.problems?.length || 0} problems</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── COURSES TAB ──────────
function CoursesTab({ courses, isEnrolled, onEnroll, myEnrollments }) {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-extrabold mb-1">Browse Courses</h1>
        <p className="text-white/50 text-sm">Enroll in courses offered by faculty to access their exams and labs</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-5xl mb-3">📚</p>
          <p className="text-white/50">No courses available yet. Faculty need to register and create courses first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c, i) => {
            const enrolled = isEnrolled(c.facultyId);
            return (
              <div key={i} className={`rounded-2xl p-5 border transition ${
                enrolled
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-white/[0.03] border-white/10 hover:border-indigo-500/30 hover:shadow-lg'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">{c.courseName}</h3>
                    <p className="text-white/50 text-sm">by {c.facultyName}</p>
                  </div>
                  {enrolled && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/20 text-green-300">✓ Enrolled</span>
                  )}
                </div>
                {!enrolled ? (
                  <button onClick={() => onEnroll(c.facultyId, c.courseName)}
                    className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition">
                    Enroll in Course
                  </button>
                ) : (
                  <p className="text-green-300/60 text-xs mt-3">You have access to this course's exams and labs</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm font-medium">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-white text-2xl font-extrabold">{value}</p>
    </div>
  );
}
