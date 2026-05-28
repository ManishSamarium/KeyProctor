import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useKeystrokeDynamics } from '../hooks/useKeystrokeDynamics';
import { useCopyPasteBlock } from '../hooks/useCopyPasteBlock';
import { useAuthMonitor } from '../hooks/useAuthMonitor';
import api from '../api';

const DEFAULT_CODE = '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}';

export default function LabPortal() {
  const { id } = useParams();
  const { user } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [problemIdx, setProblemIdx] = useState(0);
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [output, setOutput] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cpLog, setCpLog] = useState([]);
  const [pastSubmissions, setPastSubmissions] = useState([]);
  const { onKeyDown, onKeyUp, extractFeatures, reset } = useKeystrokeDynamics();
  const sessionId = useRef(`lab_${id}_${Date.now()}`).current;
  const { confidence, authStatus, authLog, emitCpEvent } = useAuthMonitor(sessionId, extractFeatures);

  const handleCpEvent = useCallback((evt) => {
    setCpLog(prev => [...prev, evt]);
    emitCpEvent(evt);
  }, [emitCpEvent]);

  useCopyPasteBlock(handleCpEvent);

  useEffect(() => {
    api.get(`/labs/${id}`).then(r => {
      setLab(r.data);
      if (r.data.problems?.[0]?.starterCode) setCode(r.data.problems[0].starterCode);
      else setCode(DEFAULT_CODE);
    }).catch(() => navigate('/student'));
    api.get(`/labs/${id}/my-submissions`).then(r => setPastSubmissions(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (lab?.problems?.[problemIdx]) {
      setCode(lab.problems[problemIdx].starterCode || DEFAULT_CODE);
      setOutput(null);
      setTestResults(null);
    }
  }, [problemIdx]);

  const problem = lab?.problems?.[problemIdx];

  const handleRun = async () => {
    setRunning(true);
    setOutput(null);
    setTestResults(null);
    try {
      const { data } = await api.post(`/labs/${id}/run`, { code, stdin });
      setOutput(data);
    } catch (err) {
      setOutput({ stderr: err.response?.data?.error || 'Run failed', success: false });
    }
    setRunning(false);
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setSubmitting(true);
    setTestResults(null);
    setOutput(null);
    try {
      const { data } = await api.post(`/labs/${id}/submit`, { problemId: problem.problemId, code });
      setTestResults(data);
      api.get(`/labs/${id}/my-submissions`).then(r => setPastSubmissions(r.data)).catch(() => {});
    } catch (err) {
      setOutput({ stderr: err.response?.data?.error || 'Submit failed', success: false });
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    setCode(problem?.starterCode || DEFAULT_CODE);
    setOutput(null);
    setTestResults(null);
  };

  const handleEditorMount = (editor, monaco) => {
    editor.onKeyDown((e) => { onKeyDown(e.browserEvent); });
    editor.onKeyUp((e) => { onKeyUp(e.browserEvent); });
  };

  if (!lab) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading lab...</div>;

  const dotColor = authStatus === 'Verified' ? 'bg-green-400' : authStatus === 'Warning' ? 'bg-amber-400' : 'bg-red-400';
  const confidenceColor = confidence >= 0.5 ? '#22c55e' : confidence >= 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/student')} className="text-slate-400 hover:text-white text-sm cursor-pointer">← Back</button>
          <span className="text-white font-semibold">{lab.title}</span>
          {lab.deadline && <span className="text-slate-500 text-xs">Due: {lab.deadline}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />
          <span className="text-slate-400 text-sm">Auth monitoring active</span>
        </div>
      </div>

      {/* Problem tabs */}
      {lab.problems?.length > 1 && (
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-2 flex gap-2">
          {lab.problems.map((p, i) => (
            <button key={p.problemId || i} onClick={() => setProblemIdx(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                i === problemIdx ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {p.title || `Problem ${i + 1}`}
              {p.difficulty && <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${p.difficulty === 'Easy' ? 'bg-green-500/20 text-green-300' : p.difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{p.difficulty}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Problem statement */}
        <div className="w-[400px] min-w-[350px] bg-slate-800 border-r border-slate-700 overflow-y-auto p-5">
          {problem && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold text-lg">{problem.title}</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${problem.difficulty === 'Easy' ? 'bg-green-500/20 text-green-300' : problem.difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                  {problem.difficulty}
                </span>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{problem.statement}</div>

              {/* Constraints */}
              <div className="bg-slate-700/50 rounded-xl p-3 mb-4">
                <p className="text-slate-400 text-xs font-medium mb-1">Constraints</p>
                <p className="text-slate-300 text-sm">Time: {problem.timeLimitS || 3}s · Memory: {problem.memoryLimitMb || 64}MB</p>
                {problem.totalPoints > 0 && <p className="text-indigo-300 text-sm mt-1">Total Points: {problem.totalPoints}</p>}
              </div>

              {/* Sample I/O */}
              {problem.samples?.map((s, i) => (
                <div key={i} className="mb-4">
                  <p className="text-indigo-300 text-xs font-semibold mb-1">Sample {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900 rounded-lg p-2.5">
                      <p className="text-slate-500 text-xs mb-1">Input</p>
                      <pre className="text-green-300 text-sm font-mono whitespace-pre-wrap">{s.input || '(none)'}</pre>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2.5">
                      <p className="text-slate-500 text-xs mb-1">Output</p>
                      <pre className="text-green-300 text-sm font-mono whitespace-pre-wrap">{s.output}</pre>
                    </div>
                  </div>
                </div>
              ))}

              {/* Past submissions */}
              {pastSubmissions.filter(s => s.problemId === problem.problemId).length > 0 && (
                <div className="mt-4">
                  <p className="text-slate-400 text-xs font-semibold mb-2">Past Submissions</p>
                  {pastSubmissions.filter(s => s.problemId === problem.problemId).slice(0, 5).map((sub, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg mb-1 ${sub.allPassed ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`}>
                      <span>Attempt #{sub.attempt}</span>
                      <span>{sub.score}/{sub.maxScore} pts ({sub.passed}/{sub.total} passed)</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Middle panel — Code editor + terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Action bar */}
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs font-medium">C++17</span>
              <span className="text-slate-600 text-xs">|</span>
              <span className="text-slate-500 text-xs">{lab.problems?.[problemIdx]?.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowStdin(!showStdin)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${showStdin ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                📥 Stdin
              </button>
              <button onClick={handleReset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer">
                ↺ Reset
              </button>
              <button onClick={handleRun} disabled={running}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer disabled:opacity-50">
                {running ? '⏳ Running...' : '▶ Run'}
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg transition cursor-pointer disabled:opacity-50">
                {submitting ? '⏳ Grading...' : '⬆ Submit'}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="cpp"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                roundedSelection: false,
                padding: { top: 12 },
                tabSize: 4,
                wordWrap: 'off',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Stdin area */}
          {showStdin && (
            <div className="bg-slate-800 border-t border-slate-700 p-3">
              <p className="text-slate-400 text-xs font-medium mb-1">Standard Input</p>
              <textarea value={stdin} onChange={e => setStdin(e.target.value)}
                rows={3} placeholder="Enter input here..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-green-300 font-mono text-sm placeholder-slate-600 focus:border-indigo-400 focus:outline-none resize-none" />
            </div>
          )}

          {/* Terminal output */}
          <div className="h-48 min-h-[120px] bg-[#1a1a2e] border-t border-slate-700 overflow-y-auto p-4 font-mono text-sm">
            <p className="text-slate-500 text-xs font-sans font-medium mb-2">Terminal</p>
            {!output && !testResults && <p className="text-slate-600">Run or submit your code to see output here...</p>}

            {output && (
              <>
                {output.compile_error && <pre className="text-red-400 whitespace-pre-wrap">Compile Error:{'\n'}{output.compile_error}</pre>}
                {output.stderr && !output.compile_error && <pre className="text-amber-400 whitespace-pre-wrap">{output.stderr}</pre>}
                {output.stdout && <pre className="text-green-300 whitespace-pre-wrap">{output.stdout}</pre>}
                {output.success === false && !output.stdout && !output.stderr && !output.compile_error && <pre className="text-red-400">Execution failed</pre>}
                {output.time_ms !== undefined && <p className="text-slate-500 text-xs mt-2">Time: {output.time_ms}ms · Engine: {output.engine_used}</p>}
              </>
            )}

            {testResults && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-lg font-bold ${testResults.allPassed ? 'text-green-400' : 'text-red-400'}`}>
                    {testResults.allPassed ? '✅ All Passed!' : `❌ ${testResults.passed}/${testResults.total} Passed`}
                  </span>
                  <span className="text-slate-400 text-xs">Score: {testResults.score}/{testResults.maxScore}</span>
                </div>
                {testResults.compile_error && <pre className="text-red-400 whitespace-pre-wrap mb-2">Compile Error:{'\n'}{testResults.compile_error}</pre>}
                {testResults.results?.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1 ${r.status === 'pass' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <span className={`text-sm font-medium ${r.status === 'pass' ? 'text-green-300' : 'text-red-300'}`}>
                      Test {i + 1}: {r.status === 'pass' ? '✓ Passed' : '✗ Failed'}
                    </span>
                    <span className="text-slate-400 text-xs">{r.awarded}/{r.points} pts · {r.time_ms}ms</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right panel — Auth monitor */}
        <div className="w-72 bg-white border-l border-slate-200 p-5 overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-4">🛡️ Auth Monitor</h3>
          <div className="text-center mb-5">
            <div className="relative w-28 h-28 mx-auto">
              <svg viewBox="0 0 36 36" className="w-28 h-28">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke={confidenceColor}
                  strokeWidth="3" strokeDasharray={`${confidence * 100}, 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-extrabold text-slate-800">{(confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-2">Confidence Score</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-3 py-1 rounded-full ${authStatus === 'Verified' ? 'bg-green-100 text-green-700' : authStatus === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {authStatus}
            </span>
          </div>

          <h4 className="font-semibold text-slate-700 text-sm mb-2">Activity Log</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
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
              <h4 className="font-semibold text-red-600 text-sm mb-2">⚠️ Blocked Events ({cpLog.length})</h4>
              {cpLog.slice(-5).map((cp, i) => (
                <div key={i} className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-2 mb-1">
                  {cp.eventType} blocked
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
