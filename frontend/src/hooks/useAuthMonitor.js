import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { API_URL } from '../api';

export function useAuthMonitor(sessionId, extractFeatures) {
  const { token } = useSelector(s => s.auth);
  const [confidence, setConfidence] = useState(1.0);
  const [authStatus, setAuthStatus] = useState('Verified');
  const [authLog, setAuthLog] = useState([]);
  const socketRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!token || !sessionId) return;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('auth:result', (data) => {
      setConfidence(data.confidence);
      setAuthStatus(data.status);
      setAuthLog(prev => [...prev, { confidence: data.confidence, status: data.status, timestamp: Date.now() }]);
    });

    intervalRef.current = setInterval(() => {
      if (!extractFeatures) return;
      const features = extractFeatures();
      if (features.n_keys > 5) {
        socket.emit('auth:check', { features, sessionId });
      }
    }, 30000);

    return () => {
      clearInterval(intervalRef.current);
      socket.disconnect();
    };
  }, [token, sessionId]);

  const emitCpEvent = useCallback((data) => {
    socketRef.current?.emit('cp:event', { sessionId, ...data });
  }, [sessionId]);

  return { confidence, authStatus, authLog, emitCpEvent, socket: socketRef };
}
