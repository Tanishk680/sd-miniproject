const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const logger = require('../utils/logger');
const { validateConfig } = require('./schema');

const CONFIG_PATH = process.env.GATEWAY_CONFIG || path.join(__dirname, 'routes.json');

let currentConfig = null;
let lastError = null;

function parse(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = `Invalid gateway configuration (JSON syntax): ${err.message}`;
    lastError = message;
    return { error: new Error(message) };
  }
  const { value, error } = validateConfig(parsed);
  if (error) {
    const err = new Error(`Invalid gateway configuration: ${error}`);
    lastError = err.message;
    return { error: err };
  }
  lastError = null;
  return { value };
}

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const { value, error } = parse(raw);
  if (error) throw error;

  currentConfig = value;
  logger.info('Gateway configuration loaded', {
    routes: value.routes.map((r) => `${r.path} -> ${r.target}${r.auth ? ' [auth]' : ''}`)
  });
  return { value, path: CONFIG_PATH };
}

function getConfig() {
  return currentConfig;
}

function getLastConfigError() {
  return lastError;
}

let watcher = null;

function reload(onReload) {
  try {
    const { value } = loadConfig();
    logger.info('Gateway configuration reloaded', {
      routes: value.routes.map((r) => `${r.path} -> ${r.target}${r.auth ? ' [auth]' : ''}`)
    });
    if (typeof onReload === 'function') onReload(value);
    return { ok: true, value };
  } catch (err) {
    logger.error('Configuration change REJECTED; keeping previous config', { error: err.message });
    return { ok: false, error: err.message };
  }
}

function watch(onReload) {
  if (watcher) return watcher;
  watcher = chokidar.watch(CONFIG_PATH, {
    ignoreInitial: true,
    usePolling: true,
    interval: 500,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });
  watcher.on('change', () => reload(onReload));
  return watcher;
}

module.exports = { loadConfig, getConfig, getLastConfigError, CONFIG_PATH, watch, reload };