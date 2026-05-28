import { useState, useEffect } from 'react';
import api from '../api';

export default function LabManage() {
  const [labs, setLabs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewSubs, setViewSubs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [form, setForm] = useState({
    title: '', course: '', deadline: '', description: '',
    problems: [emptyProblem()]
  });

  function emptyProblem() {
    return {
      title: '', difficulty: 'Easy', statement: '',
      timeLimitS: 3, memoryLimitMb: 64,
      samples: [{ input: '', output: '' }],
      testCases: [{ input: '', expected_output: '', points: 10 }],
      starterCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}'
    };
  }

  useEffect(() => {
    api.get('/labs').then(r => setLabs(r.data)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const payload = {
        ...form,
        problems: form.problems.map((p, i) => ({
          ...p,
          problemId: `p_${i + 1}`,
          timeLimitS: parseInt(p.timeLimitS) || 3,
          memoryLimitMb: parseInt(p.memoryLimitMb) || 64,
          totalPoints: p.testCases.reduce((s, tc) => s + (parseInt(tc.points) || 0), 0),
          testCases: p.testCases.map(tc => ({ ...tc, points: parseInt(tc.points) || 0 }))
        }))
      };
      await api.post('/labs', payload);
      setShowCreate(false);
      setForm({ title: '', course: '', deadline: '', description: '', problems: [emptyProblem()] });
      api.get('/labs').then(r => setLabs(r.data));
    } catch { alert('Failed to create lab'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lab?')) return;
    await api.delete(`/labs/${id}`);
    setLabs(labs.filter(l => l._id !== id));
  };

  const handleViewSubs = async (labId) => {
    setViewSubs(labId);
    api.get(`/labs/${labId}/submissions`).then(r => setSubs(r.data)).catch(() => setSubs([]));
  };

  const updateProblem = (idx, field, value) => {
    const ps = [...form.problems];
    ps[idx] = { ...ps[idx], [field]: value };
    setForm({ ...form, problems: ps });
  };

  const addSample = (pIdx) => {
    const ps = [...form.problems];
    ps[pIdx].samples = [...ps[pIdx].samples, { input: '', output: '' }];
    setForm({ ...form, problems: ps });
  };

  const updateSample = (pIdx, sIdx, field, value) => {
    const ps = [...form.problems];
    ps[pIdx].samples = [...ps[pIdx].samples];
    ps[pIdx].samples[sIdx] = { ...ps[pIdx].samples[sIdx], [field]: value };
    setForm({ ...form, problems: ps });
  };

  const addTestCase = (pIdx) => {
    const ps = [...form.problems];
    ps[pIdx].testCases = [...ps[pIdx].testCases, { input: '', expected_output: '', points: 10 }];
    setForm({ ...form, problems: ps });
  };

  const updateTestCase = (pIdx, tIdx, field, value) => {
    const ps = [...form.problems];
    ps[pIdx].testCases = [...ps[pIdx].testCases];
    ps[pIdx].testCases[tIdx] = { ...ps[pIdx].testCases[tIdx], [field]: value };
    setForm({ ...form, problems: ps });
  };

  // Submissions view
  if (viewSubs) {
    const lab = labs.find(l => l._id === viewSubs);
    return (
      <div>
        <button onClick={() => setViewSubs(null)} className="text-indigo-600 text-sm font-medium mb-4 cursor-pointer hover:underline">← Back to Labs</button>
        <h1 className="text-2xl font-extrabold text-slate-800 mb-1">Submissions — {lab?.title}</h1>
        <p className="text-slate-500 text-sm mb-6">{subs.length} submissions</p>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Student</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Problem</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Score</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Tests</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Attempt</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.student?.fullName || '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{s.problemId}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.allPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.score}/{s.maxScore}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.passed}/{s.total}</td>
                  <td className="px-5 py-3 text-slate-600">#{s.attempt}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{new Date(s.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
              {subs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No submissions yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Labs</h1>
          <p className="text-slate-500 text-sm">Create and manage coding labs</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition">
          + Create Lab
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">New Lab</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            <input placeholder="Course (e.g. CS301)" value={form.course} onChange={e => setForm({...form, course: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
            <input type="datetime-local" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none" />
          </div>
          <textarea placeholder="Lab description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none mb-4" />

          {/* Problems */}
          {form.problems.map((prob, pIdx) => (
            <div key={pIdx} className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-700">Problem {pIdx + 1}</h4>
                {form.problems.length > 1 && (
                  <button onClick={() => setForm({...form, problems: form.problems.filter((_, i) => i !== pIdx)})}
                    className="text-red-500 text-xs cursor-pointer hover:underline">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <input placeholder="Problem title" value={prob.title} onChange={e => updateProblem(pIdx, 'title', e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm" />
                <select value={prob.difficulty} onChange={e => updateProblem(pIdx, 'difficulty', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="Time(s)" value={prob.timeLimitS} onChange={e => updateProblem(pIdx, 'timeLimitS', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm" />
                </div>
              </div>
              <textarea placeholder="Problem statement" value={prob.statement} onChange={e => updateProblem(pIdx, 'statement', e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:outline-none text-sm mb-3" />

              {/* Samples */}
              <p className="text-xs font-semibold text-slate-500 mb-1">Sample Tests (visible to student)</p>
              {prob.samples.map((s, sIdx) => (
                <div key={sIdx} className="flex gap-2 mb-2">
                  <input placeholder="Input" value={s.input} onChange={e => updateSample(pIdx, sIdx, 'input', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none" />
                  <input placeholder="Expected output" value={s.output} onChange={e => updateSample(pIdx, sIdx, 'output', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
              ))}
              <button onClick={() => addSample(pIdx)} className="text-indigo-600 text-xs font-medium cursor-pointer hover:underline mb-3">+ Add sample</button>

              {/* Hidden test cases */}
              <p className="text-xs font-semibold text-slate-500 mb-1 mt-2">Hidden Test Cases (for grading)</p>
              {prob.testCases.map((tc, tIdx) => (
                <div key={tIdx} className="flex gap-2 mb-2">
                  <input placeholder="Input" value={tc.input} onChange={e => updateTestCase(pIdx, tIdx, 'input', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none" />
                  <input placeholder="Expected output" value={tc.expected_output} onChange={e => updateTestCase(pIdx, tIdx, 'expected_output', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none" />
                  <input type="number" placeholder="Pts" value={tc.points} onChange={e => updateTestCase(pIdx, tIdx, 'points', e.target.value)}
                    className="w-16 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
              ))}
              <button onClick={() => addTestCase(pIdx)} className="text-indigo-600 text-xs font-medium cursor-pointer hover:underline mb-3">+ Add test case</button>

              {/* Starter code */}
              <p className="text-xs font-semibold text-slate-500 mb-1 mt-2">Starter Code</p>
              <textarea value={prob.starterCode} onChange={e => updateProblem(pIdx, 'starterCode', e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          ))}

          <button onClick={() => setForm({...form, problems: [...form.problems, emptyProblem()]})}
            className="text-indigo-600 text-sm font-medium mb-4 cursor-pointer hover:underline">+ Add another problem</button>

          <div className="flex gap-3 mt-2">
            <button onClick={handleCreate} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm cursor-pointer">Create Lab</button>
            <button onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Labs list */}
      <div className="space-y-3">
        {labs.map(l => (
          <div key={l._id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">{l.title}</h3>
              <p className="text-slate-500 text-sm">
                {l.course} · {l.problems?.length || 0} problems
                {l.deadline && ` · Due: ${new Date(l.deadline).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleViewSubs(l._id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer">
                Submissions
              </button>
              <button onClick={() => handleDelete(l._id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        ))}
        {labs.length === 0 && !showCreate && <p className="text-slate-400 text-sm">No labs created yet</p>}
      </div>
    </div>
  );
}
