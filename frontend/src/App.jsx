import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamPortal from './pages/ExamPortal';
import FacultyDashboard from './pages/FacultyDashboard';
import LabPortal from './pages/LabPortal';
import './index.css';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useSelector(s => s.auth);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useSelector(s => s.auth);

  return (
    <Routes>
      <Route path="/" element={
        isAuthenticated
          ? <Navigate to={user?.role === 'faculty' ? '/faculty' : '/student'} replace />
          : <LoginPage />
      } />
      <Route path="/student" element={
        <ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/exam/:id" element={
        <ProtectedRoute requiredRole="student"><ExamPortal /></ProtectedRoute>
      } />
      <Route path="/lab/:id" element={
        <ProtectedRoute requiredRole="student"><LabPortal /></ProtectedRoute>
      } />
      <Route path="/faculty" element={
        <ProtectedRoute requiredRole="faculty"><FacultyDashboard /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}
