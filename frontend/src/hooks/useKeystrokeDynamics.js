import { useRef, useCallback } from 'react';

export function useKeystrokeDynamics() {
  const buffer = useRef([]);

  const onKeyDown = useCallback((e) => {
    // ignore non-character keys to avoid noise
    buffer.current.push({ key: e.key, type: 'down', t: Date.now() });
  }, []);

  const onKeyUp = useCallback((e) => {
    buffer.current.push({ key: e.key, type: 'up', t: Date.now() });
  }, []);

  const extractFeatures = useCallback(() => {
    const events = buffer.current.filter(
      e => e.key.length === 1 || e.key === 'Backspace' || e.key === ' '
    );
    const downTimes = {};
    const dwells = [];
    const flights = [];
    let firstDown = null;
    let lastUp = null;
    let prevUp = null;

    for (const e of events) {
      if (e.type === 'down') {
        downTimes[`k_${e.t}`] = e.t;
        if (!firstDown) firstDown = e.t;
        if (prevUp !== null) flights.push(e.t - prevUp);
      } else {
        const keys = Object.keys(downTimes);
        if (keys.length > 0) {
          const last = keys[keys.length - 1];
          dwells.push(e.t - downTimes[last]);
          delete downTimes[last];
        }
        prevUp = e.t;
        lastUp = e.t;
      }
    }

    const mean = a => a.length ? a.reduce((s,v) => s+v, 0) / a.length : 0;
    const std = a => {
      const m = mean(a);
      return a.length ? Math.sqrt(a.reduce((s,v) => s+Math.pow(v-m, 2), 0)/a.length) : 0;
    };
    const median = a => {
      if (!a.length) return 0;
      const s = [...a].sort((x,y) => x-y);
      const m = Math.floor(s.length/2);
      return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
    };

    const pf = flights.filter(f => f >= 0);
    const tt = firstDown && lastUp ? lastUp - firstDown : 1000;
    const md = mean(dwells);
    const mf = mean(pf);

    return {
      mean_dwell: md, 
      std_dwell: std(dwells),
      median_dwell: median(dwells), 
      max_dwell: dwells.length ? Math.max(...dwells) : 0,
      mean_flight: mf, 
      std_flight: std(pf),
      median_flight: median(pf), 
      min_flight: pf.length ? Math.min(...pf) : 0,
      typing_speed_wpm: tt > 0 ? (events.length/5)/(tt/60000) : 0,
      dwell_flight_ratio: mf > 0 ? md/mf : 1,
      rhythm_consistency: md > 0 ? Math.max(0, Math.min(1, 1-(std(dwells)/md))) : 0,
      total_time_ms: tt,
      n_keys: events.length,
    };
  }, []);

  const reset = useCallback(() => { buffer.current = []; }, []);

  return { onKeyDown, onKeyUp, extractFeatures, reset };
}
