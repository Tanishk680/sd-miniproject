const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('ssh2');
const config = require('./config');
const topology = require('./topology.json');

const actions = new Set(['stop', 'start', 'pause', 'unpause', 'cpu']);
const services = new Set(topology.nodes.filter((node) => node.container).map((node) => node.service));

function keyPath() {
  if (!config.ssh.keyPath) return '';
  return config.ssh.keyPath.replace(/^~/, os.homedir());
}

function capabilities() {
  return {
    ssh: Boolean(config.ssh.host && keyPath() && fs.existsSync(keyPath())),
    host: config.ssh.host || null
  };
}

function validate({ action, service, cpus }) {
  if (!actions.has(action)) {
    const err = new Error('Unknown chaos action');
    err.code = 'BAD_ACTION';
    throw err;
  }
  if (!services.has(service)) {
    const err = new Error('Service is not chaos-enabled');
    err.code = 'BAD_SERVICE';
    throw err;
  }
  if (action === 'cpu') {
    const value = Number(cpus);
    if (!Number.isFinite(value) || value < 0.1 || value > 1.5) {
      const err = new Error('cpus must be between 0.1 and 1.5');
      err.code = 'BAD_CPUS';
      throw err;
    }
  }
}

function buildCommand({ action, service, cpus }) {
  const selector = `docker ps -aq -f label=com.docker.compose.service=${service} | head -n1`;
  const guard = `name=$(${selector}); if [ -z "$name" ]; then echo "container not found: ${service}" >&2; exit 3; fi; `;
  if (action === 'cpu') {
    return `${guard}docker update --cpus ${Number(cpus).toFixed(2)} "$name"`;
  }
  return `${guard}docker ${action} "$name"`;
}

function execRemote(command) {
  const sshConfig = capabilities();
  if (!sshConfig.ssh) {
    const err = new Error('SSH is not configured (EC2_HOST / EC2_KEY_PATH)');
    err.code = 'SSH_NOT_CONFIGURED';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      conn.end();
      const err = new Error('SSH command timed out');
      err.code = 'SSH_TIMEOUT';
      reject(err);
    }, 25000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          settled = true;
          conn.end();
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';
        stream.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        stream.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        stream.on('close', (code, signal) => {
          clearTimeout(timer);
          settled = true;
          conn.end();
          resolve({ code, signal, stdout: stdout.trim(), stderr: stderr.trim() });
        });
      });
    });

    conn.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    conn.connect({
      host: config.ssh.host,
      port: 22,
      username: config.ssh.user,
      privateKey: fs.readFileSync(keyPath()),
      readyTimeout: 10000,
      keepaliveInterval: 5000
    });
  });
}

async function runChaos(input) {
  validate(input);
  const command = buildCommand(input);
  const result = await execRemote(command);
  return {
    ok: result.code === 0,
    action: input.action,
    service: input.service,
    cpus: input.action === 'cpu' ? Number(input.cpus) : undefined,
    command,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

module.exports = { runChaos, capabilities, actions: [...actions], services: [...services] };
