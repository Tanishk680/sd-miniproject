const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    scenario TEXT,
    mode TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    status TEXT NOT NULL,
    summary TEXT
  );
  CREATE TABLE IF NOT EXISTS samples (
    run_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_samples_run_ts ON samples (run_id, ts);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_run_ts ON events (run_id, ts);
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_ip TEXT
  );
`);

const insertRun = db.prepare(
  'INSERT INTO runs (id, label, scenario, mode, started_at, status) VALUES (?, ?, ?, ?, ?, ?)'
);
const finishRunStmt = db.prepare('UPDATE runs SET ended_at = ?, status = ?, summary = ? WHERE id = ?');
const insertSampleStmt = db.prepare('INSERT INTO samples (run_id, ts, payload) VALUES (?, ?, ?)');
const insertEventStmt = db.prepare('INSERT INTO events (run_id, ts, kind, detail) VALUES (?, ?, ?, ?)');
const listRunsStmt = db.prepare(
  'SELECT id, label, scenario, mode, started_at, ended_at, status, summary FROM runs ORDER BY started_at DESC LIMIT ?'
);
const getRunStmt = db.prepare('SELECT * FROM runs WHERE id = ?');
const getSamplesStmt = db.prepare('SELECT ts, payload FROM samples WHERE run_id = ? ORDER BY ts');
const getEventsStmt = db.prepare('SELECT ts, kind, detail FROM events WHERE run_id = ? ORDER BY ts');
const adminByTokenStmt = db.prepare(
  "SELECT id, name, role, status, last_seen_at, last_ip FROM admin_users WHERE token_hash = ? AND status = 'active'"
);
const upsertAdminStmt = db.prepare(
  `INSERT INTO admin_users (name, token_hash, role, status, created_at)
   VALUES (?, ?, ?, 'active', ?)
   ON CONFLICT(name) DO UPDATE SET
     token_hash = excluded.token_hash,
     role = excluded.role,
     status = 'active'`
);
const adminUseStmt = db.prepare('UPDATE admin_users SET last_seen_at = ?, last_ip = ? WHERE id = ?');
const listAdminsStmt = db.prepare('SELECT id, name, role, status, created_at, last_seen_at, last_ip FROM admin_users ORDER BY created_at');
const deactivateOtherAdminsStmt = db.prepare(`
  UPDATE admin_users
   SET status = 'inactive'
 WHERE status = 'active'
   AND (SELECT count(*) FROM json_each(?)) > 0
   AND name NOT IN (SELECT value FROM json_each(?))
`);

// Any 'running' rows at startup are leftovers from a crash or hard kill.
db.prepare("UPDATE runs SET status = 'interrupted', ended_at = ? WHERE status = 'running'").run(Date.now());

function createRun({ id, label, scenario = null, mode = 'live' }) {
  insertRun.run(id, label, scenario, mode, Date.now(), 'running');
  return { id, label, scenario, mode };
}

function finishRun(id, status, summary = null) {
  finishRunStmt.run(Date.now(), status, summary ? JSON.stringify(summary) : null, id);
}

function insertSample(runId, payload, ts = Date.now()) {
  insertSampleStmt.run(runId, ts, JSON.stringify(payload));
}

function insertEvent(runId, kind, detail = null, ts = Date.now()) {
  insertEventStmt.run(runId, ts, kind, detail ? JSON.stringify(detail) : null);
}

function listRuns(limit = 100) {
  return listRunsStmt.all(limit).map((run) => {
    let summary = null;
    try {
      summary = run.summary ? JSON.parse(run.summary) : null;
    } catch (_err) {
      summary = null;
    }
    return { ...run, summary };
  });
}

function getRun(id) {
  const run = getRunStmt.get(id);
  if (!run) return null;

  const samples = getSamplesStmt.all(id).map((row) => {
    let payload = {};
    try {
      payload = JSON.parse(row.payload);
    } catch (_err) {
      payload = {};
    }
    return { ts: row.ts, ...payload };
  });

  const events = getEventsStmt.all(id).map((row) => {
    let detail = null;
    try {
      detail = row.detail ? JSON.parse(row.detail) : null;
    } catch (_err) {
      detail = row.detail;
    }
    return { ts: row.ts, kind: row.kind, detail };
  });

  return {
    ...run,
    summary: run.summary ? JSON.parse(run.summary) : null,
    samples,
    events
  };
}

function upsertAdmin({ name, tokenHash, role = 'admin' }) {
  upsertAdminStmt.run(name, tokenHash, role, Date.now());
}

function findAdminByTokenHash(tokenHash) {
  return adminByTokenStmt.get(tokenHash) || null;
}

function touchAdmin(id, ip = null) {
  adminUseStmt.run(Date.now(), ip, id);
}

function listAdmins() {
  return listAdminsStmt.all();
}

function deactivateAdminsNotIn(names) {
  const json = JSON.stringify(names || []);
  deactivateOtherAdminsStmt.run(json, json);
}

function close() {
  db.close();
}

module.exports = {
  createRun,
  finishRun,
  insertSample,
  insertEvent,
  listRuns,
  getRun,
  upsertAdmin,
  findAdminByTokenHash,
  touchAdmin,
  listAdmins,
  deactivateAdminsNotIn,
  close
};
