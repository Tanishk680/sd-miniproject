import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_KEY = 'sim_token';

export function useTwin() {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [authRequired, setAuthRequired] = useState(false);
  const [adminRequired, setAdminRequired] = useState(false);
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [topology, setTopology] = useState(null);
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      setAuthRequired(true);
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_err) {
      data = null;
    }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data?.code;
      throw err;
    }
    return data;
  }, []);

  const refreshRuns = useCallback(async () => {
    try {
      const data = await apiFetch('/api/runs');
      setRuns(data.runs || []);
      return data;
    } catch (_err) {
      return null;
    }
  }, [apiFetch]);

  const loadStatic = useCallback(async () => {
    try {
      const [topo, cfg, runData] = await Promise.all([
        apiFetch('/api/topology'),
        apiFetch('/api/settings'),
        apiFetch('/api/runs')
      ]);
      setTopology(topo);
      setSettings(cfg);
      setRuns(runData.runs || []);
      setError('');
    } catch (err) {
      if (err.message !== 'Unauthorized') setError(err.message);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((health) => {
        setAuthRequired(false);
        setAdminRequired(Boolean(health.adminRequired));
      })
      .catch(() => setError('Control server unreachable'));
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic, token]);

  useEffect(() => {
    if (authRequired && !token) {
      setConnected(false);
      return undefined;
    }

    let closed = false;
    let retry = null;

    function connect() {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const query = tokenRef.current ? `?token=${encodeURIComponent(tokenRef.current)}` : '';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws${query}`);

      ws.onopen = () => {
        setConnected(true);
        setError('');
      };
      ws.onmessage = (message) => {
        let data = null;
        try {
          data = JSON.parse(message.data);
        } catch (_err) {
          return;
        }

        if (data?.type?.startsWith('run-')) {
          setEvents((prev) => [{ ...data, at: Date.now() }, ...prev].slice(0, 40));
          if (data.type === 'run-start' || data.type === 'run-end') refreshRuns();
          return;
        }

        if (data?.nodes) {
          setSnapshot(data);
          setSnapshots((prev) => [...prev, data].slice(-120));
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => {};
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
    };
  }, [authRequired, token, refreshRuns]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const current = await apiFetch('/api/snapshot');
        setSnapshot(current);
        setSnapshots((prev) => [...prev, current].slice(-120));
      } catch (_err) {
        // websocket or auth errors surface elsewhere
      }
    }, 3000);
    return () => clearInterval(id);
  }, [apiFetch]);

  const setToken = useCallback((value) => {
    const clean = value.trim();
    if (clean) localStorage.setItem(TOKEN_KEY, clean);
    else localStorage.removeItem(TOKEN_KEY);
    setTokenState(clean);
  }, []);

  const startRun = useCallback(
    async (scenario, label) => {
      const run = await apiFetch('/api/runs', {
        method: 'POST',
        body: JSON.stringify({ scenario, label: label || undefined })
      });
      refreshRuns();
      return run;
    },
    [apiFetch, refreshRuns]
  );

  const stopRun = useCallback(
    async (id) => {
      const result = await apiFetch(`/api/runs/${id}/stop`, { method: 'POST' });
      refreshRuns();
      return result;
    },
    [apiFetch, refreshRuns]
  );

  const runChaos = useCallback(
    async (payload) =>
      apiFetch('/api/chaos', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    [apiFetch]
  );

  const getRun = useCallback((id) => apiFetch(`/api/runs/${id}`), [apiFetch]);

  return {
    token,
    setToken,
    authRequired,
    adminRequired,
    connected,
    snapshot,
    snapshots,
    topology,
    settings,
    runs,
    events,
    error,
    apiFetch,
    refreshRuns,
    startRun,
    stopRun,
    runChaos,
    getRun
  };
}
