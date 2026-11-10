import { useEffect, useState } from 'react';
import {
  Charts,
  ChaosPanel,
  EventLog,
  KpiRow,
  NodeDetail,
  ReplayBar,
  RunPanel,
  ScenarioPanel,
  ScenarioSignal,
  Toast,
  TokenForm,
  TopologyCanvas
} from './components.jsx';
import { IconActivity } from './icons.jsx';
import { useTwin } from './useTwin.js';

function Header({ twin, mode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><IconActivity /></span>
        <div>
          <h1>LIVE TWIN</h1>
          <p>e-commerce control room</p>
        </div>
      </div>
      <div className="topbar-right">
        {twin.error && <span className="top-error">{twin.error}</span>}
        <span className={`conn ${twin.connected ? 'on' : 'off'}`}>
          <i /> {twin.connected ? 'streaming' : 'reconnecting'}
        </span>
        <span className="mode-pill">{mode}</span>
        {twin.adminRequired && <TokenForm compact onSave={twin.setToken} initial={twin.token} />}
        {twin.token && twin.adminRequired && (
          <button className="icon-btn" onClick={() => twin.setToken('')} title="Forget token">×</button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const twin = useTwin();
  const [selectedId, setSelectedId] = useState('gateway');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [replay, setReplay] = useState(null);

  const showToast = (message, tone = 'ok') => setToast({ message, tone, clear: () => setToast(null) });

  const liveSnapshot = twin.snapshot;
  const displaySnapshot = replay ? replay.run.samples[replay.index] : liveSnapshot;
  const activeRunId = replay ? null : liveSnapshot?.runId;
  const activeRun =
    twin.runs.find((run) => run.id === activeRunId) ||
    (activeRunId ? twin.settings?.activeRun : null);
  const activeScenario = twin.settings?.scenarios?.find((scenario) => scenario.id === activeRun?.scenario);
  const chartScenario = activeScenario ||
    (replay ? twin.settings?.scenarios?.find((scenario) => scenario.id === replay.run.scenario) : null);
  const history = replay ? replay.run.samples.slice(0, replay.index + 1) : twin.snapshots;
  const topologyNode = twin.topology?.nodes?.find((node) => node.id === selectedId);
  const mode = replay ? 'replay' : displaySnapshot?.mode || twin.settings?.mode || 'live';

  useEffect(() => {
    if (!replay?.playing) return undefined;
    const id = setInterval(() => {
      setReplay((prev) => {
        if (!prev) return prev;
        const last = prev.run.samples.length - 1;
        if (prev.index >= last) return { ...prev, playing: false };
        return { ...prev, index: prev.index + 1 };
      });
    }, 650);
    return () => clearInterval(id);
  }, [replay?.playing, replay?.run?.id]);

  // public scenario access no longer gates the whole UI; chaos remains admin-only.

  if (!twin.topology) {
    return (
      <div className="app">
        <Header twin={twin} mode={mode} />
        <div className="gate">
          <div className="gate-card">
            <span className="eyebrow"><IconActivity /> live twin</span>
            <h1>{twin.error ? 'Control server offline' : 'Connecting…'}</h1>
            <p>{twin.error || 'Waiting for the control server on 127.0.0.1:7070.'}</p>
          </div>
        </div>
      </div>
    );
  }

  async function handleStart(scenarioId) {
    setBusy(true);
    try {
      const run = await twin.startRun(scenarioId, label);
      setLabel('');
      showToast(`Started ${run.label}`);
    } catch (err) {
      showToast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!activeRunId) return;
    setBusy(true);
    try {
      await twin.stopRun(activeRunId);
      showToast('Stop requested');
    } catch (err) {
      showToast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function handleChaos(payload) {
    setBusy(true);
    try {
      const result = await twin.runChaos(payload);
      showToast(result.ok ? `${payload.action} ${payload.service}` : `Chaos failed: ${result.stderr || result.code}`);
    } catch (err) {
      showToast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function handleRecover() {
    const services = twin.settings?.chaos?.services || [];
    if (!services.length) return;
    setBusy(true);
    let started = 0;
    for (const service of services) {
      try {
        await twin.runChaos({ action: 'start', service });
        started += 1;
      } catch (_err) {
        // keep going; report the summary
      }
    }
    setBusy(false);
    showToast(`Start attempted for ${started}/${services.length} services`);
  }

  async function openReplay(run) {
    try {
      const full = await twin.getRun(run.id);
      setReplay({ run: full, index: 0, playing: (full.samples || []).length > 0 });
      setSelectedId('gateway');
    } catch (err) {
      showToast(err.message, 'bad');
    }
  }

  async function handleExport(run) {
    try {
      const headers = twin.token ? { Authorization: `Bearer ${twin.token}` } : {};
      const res = await fetch(`/api/runs/${run.id}/export`, { headers });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `run-${run.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Run exported');
    } catch (err) {
      showToast(err.message, 'bad');
    }
  }

  return (
    <div className="app">
      <Header twin={twin} mode={mode} />

      <main className="main">
        <aside className="col col-left">
          <ScenarioPanel
            scenarios={twin.settings?.scenarios}
            activeRun={activeRun}
            busy={busy}
            label={label}
            setLabel={setLabel}
            onStart={handleStart}
            onStop={handleStop}
          />
          <ChaosPanel
            chaos={twin.settings?.chaos}
            busy={busy}
            token={twin.token}
            adminRequired={twin.adminRequired}
            onChaos={handleChaos}
            onRecover={handleRecover}
          />
        </aside>

        <section className="center">
          <KpiRow
            snapshot={displaySnapshot}
            connected={twin.connected}
            mode={mode}
            activeRun={activeRun}
          />

          <ScenarioSignal
            scenario={activeScenario}
            snapshot={displaySnapshot}
            activeRun={activeRun}
            rateLimitRps={twin.settings?.rateLimitRps || 83}
          />

          <div className="canvas-card">
            <TopologyCanvas
              topology={twin.topology}
              snapshot={displaySnapshot}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {replay && (
            <ReplayBar
              run={replay.run}
              index={replay.index}
              playing={replay.playing}
              onSeek={(index) => setReplay((prev) => (prev ? { ...prev, index } : prev))}
              onToggle={() => setReplay((prev) => (prev ? { ...prev, playing: !prev.playing } : prev))}
              onExit={() => setReplay(null)}
            />
          )}

          <Charts
            history={history}
            selectedId={selectedId}
            selectedLabel={topologyNode?.label}
            rateLimitRps={twin.settings?.rateLimitRps || 83}
            phases={chartScenario?.phases}
            runStartedAt={activeRun?.startedAt || replay?.run?.started_at}
          />
        </section>

        <aside className="col col-right">
          <NodeDetail
            topologyNode={topologyNode}
            data={displaySnapshot?.nodes?.[selectedId]}
            history={history}
            selectedId={selectedId}
          />
          <RunPanel
            runs={twin.runs}
            activeRunId={activeRunId}
            replayRunId={replay?.run?.id}
            onReplay={openReplay}
            onExport={handleExport}
            onRefresh={twin.refreshRuns}
          />
          <EventLog events={twin.events} />
        </aside>
      </main>

      <Toast toast={toast} />
    </div>
  );
}
