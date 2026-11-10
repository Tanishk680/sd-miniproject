import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow
} from '@xyflow/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  IconActivity,
  IconAlert,
  IconArrowLeft,
  IconBolt,
  IconCpu,
  IconDatabase,
  IconDownload,
  IconGlobe,
  IconPause,
  IconPlay,
  IconRefresh,
  IconServer,
  IconStop
} from './icons.jsx';
import {
  clock,
  currentPhase,
  elapsed,
  fmtBytes,
  fmtCpu,
  fmtInt,
  fmtPct,
  fmtRps,
  fmtSeconds,
  loadClass,
  phaseBoundaries
} from './format.js';

function KindIcon({ kind }) {
  if (kind === 'db') return <IconDatabase />;
  if (kind === 'client') return <IconActivity />;
  if (kind === 'edge') return <IconGlobe />;
  return <IconServer />;
}

export function TwinNode({ data, selected }) {
  const { node, metrics } = data;
  const tone = loadClass(metrics);

  return (
    <div className={`twin-node ${tone} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="twin-handle" />
      <div className="node-head">
        <span className={`status-dot ${tone}`} />
        <span className="node-kind">{node.kind}</span>
        <span className="node-icon"><KindIcon kind={node.kind} /></span>
      </div>
      <div className="node-label">{node.label}</div>
      <div className="node-stats">
        {node.app ? (
          <>
            <span><b>{fmtRps(metrics?.rps)}</b> rps</span>
            <span><b>{fmtSeconds(metrics?.p95)}</b> p95</span>
          </>
        ) : (
          <>
            <span><b>{fmtCpu(metrics?.cpuCores)}</b> cpu</span>
            <span><b>{fmtBytes(metrics?.memBytes)}</b> mem</span>
          </>
        )}
      </div>
      {metrics?.errorRate > 0.01 && (
        <div className="node-alert"><IconAlert /> {fmtPct(metrics.errorRate)} 5xx</div>
      )}
      {metrics?.rateLimited > 0.01 && (
        <div className="node-alert warm"><IconBolt /> {fmtRps(metrics.rateLimited)}/s 429</div>
      )}
      {metrics?.healthGateRejections > 0.01 && (
        <div className="node-alert"><IconAlert /> gate {fmtRps(metrics.healthGateRejections)}/s</div>
      )}
      <Handle type="source" position={Position.Right} className="twin-handle" />
    </div>
  );
}

const nodeTypes = { twin: TwinNode };

export function TopologyCanvas({ topology, snapshot, selectedId, onSelect }) {
  const flow = useMemo(() => {
    if (!topology) return { nodes: [], edges: [] };

    const nodes = topology.nodes.map((node) => ({
      id: node.id,
      type: 'twin',
      position: node.position,
      selected: node.id === selectedId,
      draggable: false,
      data: {
        node,
        metrics: snapshot?.nodes?.[node.id]
      }
    }));

    const edges = topology.edges.map((edge) => {
      const rps = snapshot?.edges?.[edge.id]?.rps || 0;
      const hot = rps > 65;
      const color = rps > 0 ? (hot ? '#f59e0b' : '#38bdf8') : '#334155';
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: rps > 0,
        label: rps > 0 ? `${fmtRps(rps)}/s` : undefined,
        labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0b1220', fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        style: { stroke: color, strokeWidth: rps > 0 ? 2 : 1.2, opacity: rps > 0 ? 0.9 : 0.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color }
      };
    });

    return { nodes, edges };
  }, [topology, snapshot, selectedId]);

  if (!topology) {
    return <div className="canvas-empty">Waiting for topology…</div>;
  }

  return (
    <div className="canvas-inner">
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => onSelect(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.35}
        maxZoom={1.4}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1e293b" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable={false}
          zoomable={false}
          maskColor="rgba(3, 7, 18, 0.78)"
          nodeColor={(node) => {
            const status = node.data?.metrics?.status;
            if (status === 'down') return '#ef4444';
            if (status === 'unknown') return '#475569';
            return node.id === selectedId ? '#38bdf8' : '#64748b';
          }}
        />
      </ReactFlow>
      <div className="canvas-legend">
        <span><i className="legend-dot good" /> healthy</span>
        <span><i className="legend-dot warm" /> high load</span>
        <span><i className="legend-dot bad" /> errors</span>
        <span><i className="legend-dot unknown" /> no data</span>
      </div>
    </div>
  );
}

function Elapsed({ startedAt }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{elapsed(startedAt)}</span>;
}

export function KpiRow({ snapshot, connected, mode, activeRun }) {
  const gateway = snapshot?.nodes?.gateway;
  const nodes = snapshot?.nodes ? Object.values(snapshot.nodes) : [];
  const cpu = nodes.reduce((sum, node) => sum + (node.cpuCores || 0), 0);
  const memory = nodes.reduce((sum, node) => sum + (node.memBytes || 0), 0);

  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <span className="kpi-label">Gateway traffic</span>
        <strong className="kpi-value">{fmtRps(gateway?.rps)} <small>rps</small></strong>
        <span className="kpi-sub">{activeRun ? <><i className="live-dot" /> run active</> : 'live window'}</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-label">Server p95</span>
        <strong className="kpi-value">{fmtSeconds(gateway?.p95)}</strong>
        <span className="kpi-sub">gateway histogram</span>
      </div>
      <div className={`kpi-card ${gateway?.errorRate > 0.05 ? 'is-bad' : ''}`}>
        <span className="kpi-label">5xx error rate</span>
        <strong className="kpi-value">{fmtPct(gateway?.errorRate)}</strong>
        <span className="kpi-sub">{gateway?.errorRate > 0.05 ? 'gate failing' : 'within budget'}</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-label">In flight</span>
        <strong className="kpi-value">{fmtInt(gateway?.inflight)}</strong>
        <span className="kpi-sub">open requests</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-label">Container load</span>
        <strong className="kpi-value">{fmtCpu(cpu)}</strong>
        <span className="kpi-sub">{fmtBytes(memory)} resident</span>
      </div>
      <div className="kpi-card kpi-status">
        <span className={`status-dot ${connected ? 'good' : 'down'}`} />
        <span className="kpi-label">{connected ? 'Streaming' : 'Reconnecting'}</span>
        <span className="kpi-sub">{mode || 'live'} · 1s cadence</span>
      </div>
    </div>
  );
}

export function ScenarioPanel({ scenarios, activeRun, busy, label, setLabel, onStart, onStop }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Scenarios</h2>
          <p className="panel-sub">Launch k6 against the real gateway.</p>
        </div>
        <span className="count-pill">{scenarios?.length || 0}</span>
      </div>

      {activeRun ? (
        <div className="active-run">
          <div>
            <span className="eyebrow"><i className="live-dot" /> running</span>
            <strong>{activeRun.label || activeRun.scenario}</strong>
            <span className="active-meta">{activeRun.scenario} · <Elapsed startedAt={activeRun.startedAt} /></span>
          </div>
          <button className="btn danger" onClick={onStop} disabled={busy}>
            <IconStop /> Stop
          </button>
        </div>
      ) : (
        <input
          className="text-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Run label (optional)"
          maxLength={80}
        />
      )}

      <div className="scenario-list">
        {(scenarios || []).map((scenario) => (
          <button
            key={scenario.id}
            className="scenario-row"
            onClick={() => onStart(scenario.id)}
            disabled={busy || Boolean(activeRun)}
          >
            <span className="scenario-play"><IconPlay /></span>
            <span className="scenario-copy">
              <span className="scenario-title">
                <strong>{scenario.name}</strong>
                {scenario.signal && (
                  <em className={`scenario-tag ${scenario.signal.tone || 'info'}`}>
                    {scenario.signal.label}
                    {scenario.signal.targetRps ? ` · ${scenario.signal.targetRps} rps` : ''}
                  </em>
                )}
              </span>
              <small>{scenario.description}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ScenarioSignal({ scenario, snapshot, activeRun, rateLimitRps }) {
  if (!activeRun || !scenario) return null;

  const signal = scenario.signal || {};
  const gateway = snapshot?.nodes?.gateway;
  const cap = Number(rateLimitRps) || 83;
  const target = Number(signal.targetRps) || 0;
  const liveRps = gateway?.rps || 0;
  const limited = gateway?.rateLimited || 0;
  const gateRejected = gateway?.healthGateRejections || 0;
  const overCap = liveRps >= cap;
  const crosses = Boolean(signal.crossesLimit);
  const phase = currentPhase(scenario.phases, activeRun.startedAt);

  let tone = 'ok';
  let state = crosses ? 'Below trigger' : 'Below cap';
  if (gateRejected > 0.01) {
    tone = 'bad';
    state = 'Health gate rejecting';
  } else if (limited > 0.01) {
    tone = 'warn';
    state = 'Rate limiter active';
  } else if (overCap) {
    tone = 'warn';
    state = crosses ? 'At trigger' : 'Above cap';
  } else if (crosses) {
    tone = 'info';
  }

  return (
    <div className={`scenario-signal ${tone}`}>
      <div className="signal-top">
        <span className={`signal-badge ${tone}`}>{signal.label || scenario.name}</span>
        {phase && (
          <span className={`signal-phase ${phase.done ? 'done' : phase.name}`}>
            {phase.done ? 'complete' : phase.name} {Math.max(0, Math.ceil(phase.remainingMs / 1000))}s
          </span>
        )}
        <strong>{signal.expectation || scenario.description}</strong>
        <span className={`signal-state ${tone}`}>{state}</span>
      </div>
      <div className="signal-bottom">
        {target > 0 && <span>target <b>{fmtRps(target)} rps</b></span>}
        <span>live <b>{fmtRps(liveRps)} rps</b></span>
        <span>gateway cap <b>{fmtRps(cap)} rps</b></span>
        <span className={limited > 0.01 ? 'hot' : ''}>429 <b>{fmtRps(limited)}/s</b></span>
        <span>5xx <b>{fmtPct(gateway?.errorRate)}</b></span>
        <span>p95 <b>{fmtSeconds(gateway?.p95)}</b></span>
        {gateRejected > 0.01 && <span className="hot">gate <b>{fmtRps(gateRejected)}/s</b></span>}
      </div>
      <div className="limit-meter">
        <i style={{ width: `${Math.min(100, (liveRps / cap) * 100)}%` }} />
      </div>
    </div>
  );
}

export function ChaosPanel({ chaos, busy, token, adminRequired, onChaos, onRecover }) {
  const services = chaos?.services || [];
  const [service, setService] = useState('');
  const [cpus, setCpus] = useState(0.5);

  useEffect(() => {
    if (!service && services.length > 0) setService(services[0]);
  }, [services, service]);

  const adminLocked = Boolean(adminRequired) && !token;
  const disabled = busy || adminLocked || !chaos?.ssh;

  function act(action) {
    if (action === 'stop' && !window.confirm(`Stop ${service}? The gateway health gate will react.`)) return;
    onChaos({ action, service, cpus: Number(cpus) });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Chaos</h2>
          <p className="panel-sub">Docker actions over SSH, allow-listed.</p>
        </div>
        <span className={`chip ${chaos?.ssh ? 'ok' : 'off'}`}>{chaos?.ssh ? 'SSH ready' : 'SSH offline'}</span>
      </div>

      {!chaos?.ssh && (
        <p className="hint">
          Set <code>EC2_HOST</code> and <code>EC2_KEY_PATH</code> in <code>sim/server/.env</code> to enable.
        </p>
      )}
      {adminLocked && (
        <p className="hint">Admin token required for chaos actions.</p>
      )}

      <label className="field">
        <span>Target service</span>
        <select className="text-input" value={service} onChange={(event) => setService(event.target.value)}>
          {services.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>

      <div className="chaos-grid">
        <button className="btn" onClick={() => act('pause')} disabled={disabled}><IconPause /> Pause</button>
        <button className="btn" onClick={() => act('unpause')} disabled={disabled}><IconPlay /> Resume</button>
        <button className="btn danger" onClick={() => act('stop')} disabled={disabled}><IconStop /> Stop</button>
        <button className="btn" onClick={() => act('start')} disabled={disabled}><IconRefresh /> Start</button>
      </div>

      <div className="cpu-control">
        <div className="cpu-label">
          <span><IconCpu /> CPU limit</span>
          <strong>{Number(cpus).toFixed(2)} cores</strong>
        </div>
        <input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          value={cpus}
          onChange={(event) => setCpus(Number(event.target.value))}
          disabled={disabled}
        />
        <button className="btn wide" onClick={() => act('cpu')} disabled={disabled}>
          <IconBolt /> Apply limit
        </button>
      </div>

      <button className="btn quiet wide" onClick={onRecover} disabled={busy || !chaos?.ssh}>
        <IconRefresh /> Start all services
      </button>
    </section>
  );
}

function NodeSpark({ history, id }) {
  const data = history.slice(-45).map((sample) => ({
    t: sample.ts,
    rps: sample.nodes?.[id]?.rps || 0,
    p95: (sample.nodes?.[id]?.p95 || 0) * 1000
  }));

  if (data.length < 2) return <div className="chart-empty">Waiting for samples…</div>;

  return (
    <ResponsiveContainer width="100%" height={92}>
      <AreaChart data={data} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
          labelFormatter={(value) => clock(value)}
          formatter={(value, name) => [name === 'p95' ? `${Math.round(value)}ms` : fmtRps(value), name]}
        />
        <Area type="monotone" dataKey="rps" stroke="#38bdf8" fill={`url(#spark-${id})`} strokeWidth={1.5} dot={false} />
        <Area type="monotone" dataKey="p95" stroke="#f59e0b" fill="transparent" strokeWidth={1.2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function NodeDetail({ topologyNode, data, history, selectedId }) {
  const status = data?.status || 'unknown';
  return (
    <section className="panel detail-panel">
      <div className="panel-head">
        <div>
          <h2>{topologyNode?.label || 'Select a node'}</h2>
          <p className="panel-sub">{topologyNode ? `${topologyNode.kind} · ${selectedId}` : 'Click any node on the canvas'}</p>
        </div>
        <span className={`chip ${status}`}>{status}</span>
      </div>

      {topologyNode ? (
        <>
          <div className="detail-grid">
            <div><span>RPS</span><strong>{fmtRps(data?.rps)}</strong></div>
            <div><span>p95</span><strong>{fmtSeconds(data?.p95)}</strong></div>
            <div><span>5xx rate</span><strong>{fmtPct(data?.errorRate)}</strong></div>
            <div><span>4xx rate</span><strong>{fmtPct(data?.clientErrorRate)}</strong></div>
            {selectedId === 'gateway' && (
              <div><span>429 rate</span><strong>{fmtRps(data?.rateLimited)}/s</strong></div>
            )}
            <div><span>In flight</span><strong>{fmtInt(data?.inflight)}</strong></div>
            <div><span>CPU</span><strong>{fmtCpu(data?.cpuCores)}</strong></div>
            <div><span>Memory</span><strong>{fmtBytes(data?.memBytes)}</strong></div>
            <div><span>Throttle</span><strong>{fmtPct(data?.throttle)}</strong></div>
          </div>
          <NodeSpark history={history} id={selectedId} />
        </>
      ) : (
        <p className="hint">Select a node to inspect its live vector.</p>
      )}
    </section>
  );
}

function ChartCard({ title, subtitle, data, dataKey, color, unit, domain, reference, referenceLabel, markers }) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      {data.length < 2 ? (
        <div className="chart-empty">Collecting samples…</div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id={`chart-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.42} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis
              width={44}
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={domain || [0, 'auto']}
            />
            {Number.isFinite(reference) && reference > 0 && (
              <ReferenceLine
                y={reference}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                ifOverflow="extendDomain"
                label={{
                  value: referenceLabel || `cap ${reference}`,
                  fill: '#fbbf24',
                  fontSize: 9,
                  position: 'insideTopRight'
                }}
              />
            )}
            {(markers || []).map((marker) => (
              <ReferenceLine
                key={`${marker.name}-${marker.at}`}
                x={marker.at}
                stroke="#a78bfa"
                strokeOpacity={0.65}
                strokeDasharray="2 4"
                ifOverflow="hidden"
                label={{
                  value: marker.name,
                  fill: '#c4b5fd',
                  fontSize: 9,
                  position: 'insideTopLeft'
                }}
              />
            ))}
            <Tooltip
              contentStyle={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              labelFormatter={(value) => clock(value)}
              formatter={(value) => [`${Math.round(value * 10) / 10}${unit || ''}`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#chart-${dataKey})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function Charts({ history, selectedId, selectedLabel, rateLimitRps, phases, runStartedAt }) {
  const markers = phaseBoundaries(phases, runStartedAt);
  const gatewayData = history.slice(-60).map((sample) => ({
    t: sample.ts,
    rps: sample.nodes?.gateway?.rps || 0,
    p95: (sample.nodes?.gateway?.p95 || 0) * 1000,
    error: (sample.nodes?.gateway?.errorRate || 0) * 100,
    nodeRps: sample.nodes?.[selectedId]?.rps || 0,
    nodeP95: (sample.nodes?.[selectedId]?.p95 || 0) * 1000
  }));

  return (
    <div className="charts-row">
      <ChartCard
        title="Gateway traffic"
        subtitle="requests / second"
        data={gatewayData}
        dataKey="rps"
        color="#38bdf8"
        reference={rateLimitRps}
        referenceLabel={`cap ${rateLimitRps} rps`}
        markers={markers}
      />
      <ChartCard
        title="Gateway p95"
        subtitle="milliseconds"
        data={gatewayData}
        dataKey="p95"
        color="#f59e0b"
        unit="ms"
        markers={markers}
      />
      <ChartCard
        title={selectedLabel ? `Selected · ${selectedLabel}` : `Selected · ${selectedId || 'none'}`}
        subtitle="requests / second"
        data={gatewayData}
        dataKey="nodeRps"
        color="#a78bfa"
        markers={markers}
      />
    </div>
  );
}

function StatusChip({ status }) {
  return <span className={`status-chip ${status}`}>{status}</span>;
}

export function RunPanel({ runs, activeRunId, replayRunId, onReplay, onExport, onRefresh }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Runs</h2>
          <p className="panel-sub">Recorded telemetry and replay.</p>
        </div>
        <button className="icon-btn" onClick={onRefresh} title="Refresh runs"><IconRefresh /></button>
      </div>

      <div className="run-list">
        {(runs || []).length === 0 && <p className="hint">No runs yet. Launch a scenario above.</p>}
        {(runs || []).map((run) => {
          const metrics = run.summary?.metrics;
          const verdict = run.summary?.verdict;
          const expects429 = ['rate-limit', 'breaking-point'].includes(run.scenario);
          return (
            <button
              key={run.id}
              className={`run-row ${run.id === activeRunId ? 'is-active' : ''} ${run.id === replayRunId ? 'is-replay' : ''}`}
              onClick={() => onReplay(run)}
            >
              <div className="run-top">
                <StatusChip status={run.status} />
                <span className="run-label">{run.label}</span>
                <span className="run-time">{clock(run.started_at)}</span>
              </div>
              <div className="run-meta">
                <span>{run.scenario || run.mode}</span>
                {verdict && <span className={`run-signal ${verdict.tone}`}>{verdict.label}</span>}
                {!verdict && metrics?.rate_limited > 0 && (
                  <span className="run-signal warn">{fmtInt(metrics.rate_limited)} 429s</span>
                )}
                {!verdict && metrics?.rate_limited === 0 && expects429 && (
                  <span className="run-signal warn">no 429 observed</span>
                )}
                {!verdict && metrics && metrics.http_fail_rate > 0.05 && (
                  <span className="run-signal bad">{fmtPct(metrics.http_fail_rate)} fail</span>
                )}
                {metrics?.server_errors > 0 && <span className="run-signal bad">{fmtInt(metrics.server_errors)} 5xx</span>}
                {metrics && <span>{fmtInt(metrics.http_reqs)} reqs · p95 {Math.round(metrics.p95_ms)}ms</span>}
              </div>
              <span
                className="run-export"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onExport(run);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation();
                    onExport(run);
                  }
                }}
              >
                <IconDownload />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function eventText(event) {
  if (event.type === 'run-start') return `Run started · ${event.run?.label || event.run?.scenario || ''}`;
  if (event.type === 'run-end') {
    const metrics = event.metrics;
    const suffix = metrics ? ` · ${fmtInt(metrics.http_reqs)} reqs · p95 ${Math.round(metrics.p95_ms)}ms` : '';
    const verdict = event.verdict?.label ? ` · ${event.verdict.label}` : '';
    return `Run ${event.status}${suffix}${verdict}`;
  }
  return event.message || event.type;
}

export function EventLog({ events }) {
  return (
    <section className="panel log-panel">
      <div className="panel-head">
        <div>
          <h2>Events</h2>
          <p className="panel-sub">Run lifecycle stream.</p>
        </div>
        <span className="count-pill">{events.length}</span>
      </div>
      <div className="log-list">
        {events.length === 0 && <p className="hint">No events yet.</p>}
        {events.slice(0, 14).map((event, index) => (
          <div className="log-row" key={`${event.at}-${index}`}>
            <span className="log-time">{clock(event.at)}</span>
            <span className={`log-kind ${event.type}`}>{event.type.replace('run-', '')}</span>
            <span className="log-text">{eventText(event)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReplayBar({ run, index, playing, onSeek, onToggle, onExit }) {
  const samples = run.samples || [];
  const max = Math.max(0, samples.length - 1);
  const sample = samples[index];

  return (
    <div className="replay-bar">
      <span className="replay-badge"><IconActivity /> replay</span>
      <strong className="replay-label">{run.label}</strong>
      <input
        className="replay-range"
        type="range"
        min="0"
        max={max}
        value={Math.min(index, max)}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={samples.length === 0}
      />
      <span className="replay-time">
        {sample ? clock(sample.ts) : '—'} · {Math.min(index + 1, samples.length)}/{samples.length}
      </span>
      <button className="btn small" onClick={onToggle} disabled={samples.length === 0}>
        {playing ? <><IconPause /> Pause</> : <><IconPlay /> Play</>}
      </button>
      <button className="btn small quiet" onClick={onExit}><IconArrowLeft /> Live</button>
    </div>
  );
}

export function TokenForm({ onSave, compact, initial }) {
  const [value, setValue] = useState(initial || '');
  return (
    <form
      className={`token-form ${compact ? 'compact' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <input
        className="text-input"
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Admin token"
        autoComplete="off"
      />
      <button className="btn" type="submit">Connect</button>
    </form>
  );
}

export function TokenGate({ onSave }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <span className="eyebrow"><IconActivity /> live twin</span>
        <h1>Control room locked</h1>
        <p>The control server requires an admin bearer token. Paste one of the values from <code>SIM_ADMIN_IDENTITIES</code> in <code>sim/server/.env</code>.</p>
        <TokenForm onSave={onSave} />
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(toast.clear, 4200);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return <div className={`toast ${toast.tone || ''}`}>{toast.message}</div>;
}
