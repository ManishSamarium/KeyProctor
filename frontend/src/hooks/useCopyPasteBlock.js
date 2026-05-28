import { useEffect, useCallback, useRef } from 'react';

export function useCopyPasteBlock(onEvent) {
  const toastRef = useRef(null);

  const showToast = useCallback((msg, isError = false) => {
    if (toastRef.current) {
      clearTimeout(toastRef.current._timeout);
      toastRef.current.remove();
    }
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
      color: 'white', zIndex: '99999', transition: 'opacity 0.3s',
      background: isError ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    });
    document.body.appendChild(el);
    toastRef.current = el;
    el._timeout = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2000);
  }, []);

  useEffect(() => {
    const blockPaste = (e) => {
      e.preventDefault();
      showToast('🚫 Paste is disabled', true);
      onEvent?.({ eventType: 'paste', timestamp: Date.now() });
    };
    const blockCopy = (e) => {
      e.preventDefault();
      showToast('⚠️ Copy is disabled');
      onEvent?.({ eventType: 'copy', timestamp: Date.now() });
    };
    const blockCut = (e) => {
      e.preventDefault();
      showToast('⚠️ Cut is disabled');
      onEvent?.({ eventType: 'cut', timestamp: Date.now() });
    };
    const blockDrop = (e) => {
      e.preventDefault();
      showToast('⚠️ Drop is disabled');
    };
    const blockContext = (e) => e.preventDefault();
    const blockKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const names = { c: 'Copy', v: 'Paste', x: 'Cut', a: 'Select All' };
        showToast(`🚫 ${names[e.key.toLowerCase()]} shortcut blocked`, e.key.toLowerCase() === 'v');
        if (e.key.toLowerCase() === 'v') onEvent?.({ eventType: 'paste', timestamp: Date.now() });
      }
    };

    document.addEventListener('paste', blockPaste, true);
    document.addEventListener('copy', blockCopy, true);
    document.addEventListener('cut', blockCut, true);
    document.addEventListener('drop', blockDrop, true);
    document.addEventListener('contextmenu', blockContext, true);
    document.addEventListener('keydown', blockKeys, true);

    return () => {
      document.removeEventListener('paste', blockPaste, true);
      document.removeEventListener('copy', blockCopy, true);
      document.removeEventListener('cut', blockCut, true);
      document.removeEventListener('drop', blockDrop, true);
      document.removeEventListener('contextmenu', blockContext, true);
      document.removeEventListener('keydown', blockKeys, true);
    };
  }, [onEvent, showToast]);
}
