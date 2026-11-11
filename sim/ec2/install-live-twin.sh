#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="${REPO_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_ROOT="${APP_ROOT:-/opt/sim}"
SERVER_ROOT="${SERVER_ROOT:-${APP_ROOT}/server}"
UI_ROOT="${UI_ROOT:-${APP_ROOT}/ui}"
DATA_ROOT="${DATA_ROOT:-/var/lib/sim}"
ETC_ROOT="${ETC_ROOT:-/etc/sim}"
ENV_FILE="${ENV_FILE:-${ETC_ROOT}/.env}"
SERVICE_USER="${SERVICE_USER:-sim}"
SERVICE_GROUP="${SERVICE_GROUP:-${SERVICE_USER}}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
LIVE_TWIN_SERVICE="${LIVE_TWIN_SERVICE:-/etc/systemd/system/live-twin.service}"
K6_BIN="${K6_BIN:-/usr/local/bin/k6}"
CADDY_VERSION="${CADDY_VERSION:-2.10.2}"
PROMETHEUS_VERSION="${PROMETHEUS_VERSION:-2.53.4}"
FORCE="${FORCE:-0}"
ENABLE_CLOUDFLARED="${ENABLE_CLOUDFLARED:-0}"
START_SERVICES="${START_SERVICES:-0}"

if [[ ! -d "${REPO_PATH}/sim" ]]; then
  echo "Repository root not found at ${REPO_PATH}" >&2
  exit 1
fi

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "This script must be run as root." >&2
    exit 1
  fi
}

verify_arch() {
  if [[ "$(uname -m)" != "x86_64" ]]; then
    echo "Unsupported architecture: $(uname -m). This installer ships x86_64 binaries." >&2
    exit 1
  fi
}

require_tool() {
  local tool="$1"
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Required tool is missing: ${tool}" >&2
    return 1
  fi
}

install_base_tools() {
  dnf install -y curl ca-certificates git unzip tar rsync openssh-clients
}

install_node22() {
  if command -v node >/dev/null 2>&1 && node -v | grep -q '^v22\.'; then
    echo "Node 22 already installed"
    return
  fi

  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  dnf install -y nodejs
}

install_k6() {
  if command -v k6 >/dev/null 2>&1; then
    echo "k6 already installed"
    return
  fi

  local version="v0.57.0"
  local archive="k6-${version}-linux-amd64.tar.gz"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN
  curl -fsSL "https://github.com/grafana/k6/releases/download/${version}/${archive}" -o "${tmp_dir}/${archive}"
  tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
  install -m 0755 "${tmp_dir}/k6-v0.57.0-linux-amd64/k6" "${K6_BIN}"
  trap - RETURN
}

install_cloudflared() {
  if [[ "${ENABLE_CLOUDFLARED}" != "1" ]]; then
    return
  fi

  if command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared already installed"
    return
  fi

  echo "cloudflared is optional and must be installed explicitly for temporary Quick Tunnel access."
  echo "Skip it unless you are intentionally using Cloudflare tunnels for public HTTPS."
}

ensure_caddy_runtime() {
  if ! id caddy >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
  fi
  install -d /etc/caddy
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    echo "Caddy already installed"
    ensure_caddy_runtime
    return
  fi

  # Amazon Linux 2023 has no packaged caddy; use the official static binary.
  local archive="caddy_${CADDY_VERSION}_linux_amd64.tar.gz"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/${archive}" -o "${tmp_dir}/${archive}"
  tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
  install -m 0755 "${tmp_dir}/caddy" /usr/local/bin/caddy
  trap - RETURN
  ensure_caddy_runtime
}

ensure_prometheus_runtime() {
  if ! id prometheus >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/prometheus --create-home --shell /usr/sbin/nologin prometheus
  fi
  install -d -o prometheus -g prometheus -m 0750 /var/lib/prometheus
}

install_prometheus() {
  if command -v prometheus >/dev/null 2>&1; then
    echo "Prometheus already installed"
    ensure_prometheus_runtime
    return
  fi

  local archive="prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN
  curl -fsSL "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/${archive}" -o "${tmp_dir}/${archive}"
  tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
  install -m 0755 "${tmp_dir}/prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus" /usr/local/bin/prometheus
  install -m 0755 "${tmp_dir}/prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool" /usr/local/bin/promtool
  trap - RETURN
  ensure_prometheus_runtime
}

create_service_account() {
  if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd --system --home-dir /opt/sim --create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
  fi

  install -d "${APP_ROOT}" "${SERVER_ROOT}" "${UI_ROOT}" "${DATA_ROOT}" "${DATA_ROOT}/runs" "${ETC_ROOT}" "${ETC_ROOT}/keys"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_ROOT}" "${DATA_ROOT}" "${ETC_ROOT}"
  chmod 0750 "${ETC_ROOT}"
  chmod 0700 "${ETC_ROOT}/keys"
}

copy_sources() {
  install -d "${SERVER_ROOT}" "${UI_ROOT}"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude data \
    "${REPO_PATH}/sim/server/" "${SERVER_ROOT}/"
  rsync -a --delete \
    --exclude node_modules \
    "${REPO_PATH}/sim/ui/" "${UI_ROOT}/"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${SERVER_ROOT}" "${UI_ROOT}"
}

ensure_env_template() {
  local env_template="${REPO_PATH}/sim/server/.env.example"
  if [[ ! -f "${env_template}" ]]; then
    echo "Missing env template: ${env_template}" >&2
    exit 1
  fi

  # The production env file is never overwritten, not even with FORCE=1.
  # FORCE only affects other configuration (Caddyfile, units, prometheus.yml).
  if [[ -f "${ENV_FILE}" ]]; then
    echo "Preserving existing env file: ${ENV_FILE}"
  else
    cp "${env_template}" "${ENV_FILE}"
    echo "Created env file from template: ${ENV_FILE}"
  fi

  chmod 0600 "${ENV_FILE}"
  chown "${SERVICE_USER}:${SERVICE_GROUP}" "${ENV_FILE}"
}

configure_prometheus() {
  local prom_config="${REPO_PATH}/sim/prometheus/prometheus.yml"
  if [[ ! -f "${prom_config}" ]]; then
    echo "Missing prometheus config: ${prom_config}" >&2
    exit 1
  fi

  local target="${ETC_ROOT}/prometheus.yml"
  if [[ ! -f "${target}" || "${FORCE}" == "1" ]]; then
    install -m 0644 "${prom_config}" "${target}"
  fi

  install_service_unit "${REPO_PATH}/sim/ec2/prometheus.service" /etc/systemd/system/prometheus.service "--config.file=/etc/sim/prometheus.yml"
}

configure_caddy() {
  if [[ -f "${CADDYFILE}" && "${FORCE}" != "1" ]]; then
    echo "Keeping existing Caddy file: ${CADDYFILE}"
  else
    cp "${REPO_PATH}/sim/ui/Caddyfile" "${CADDYFILE}"
    chown root:root "${CADDYFILE}"
    chmod 0644 "${CADDYFILE}"
  fi

  install_service_unit "${REPO_PATH}/sim/ec2/caddy.service" /etc/systemd/system/caddy.service "ExecStart=/usr/local/bin/caddy"
}

unit_is_compatible() {
  local target="$1"
  local marker="$2"
  grep -qs -- "${marker}" "${target}"
}

install_service_unit() {
  local src="$1"
  local target="$2"
  local marker="$3"
  if [[ -f "${target}" ]]; then
    if [[ "${FORCE}" != "1" ]] && unit_is_compatible "${target}" "${marker}"; then
      echo "Keeping existing unit: ${target}"
      return
    fi

    echo "Replacing existing unit: ${target} (backup saved alongside)"
    cp "${target}" "${target}.sim-bak"
  fi

  cp "${src}" "${target}"
  chmod 0644 "${target}"
  systemctl daemon-reload
}

install_service() {
  install_service_unit "${REPO_PATH}/sim/ec2/live-twin.service" "${LIVE_TWIN_SERVICE}" "EnvironmentFile=/etc/sim/.env"
  install_service_unit "${REPO_PATH}/sim/ec2/sim-metrics-tunnel.service" /etc/systemd/system/sim-metrics-tunnel.service "/etc/sim/keys/ecommerce.pem"
}

configure_app() {
  cd "${UI_ROOT}"
  npm ci --include=dev
  npm run build

  cd "${SERVER_ROOT}"
  npm ci --include=dev
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${SERVER_ROOT}"
}

check_env_required() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | tail -n 1 | cut -d '=' -f 2- || true)"
  if [[ -z "${value}" ]]; then
    echo "${ENV_FILE} is missing ${key}; refusing to start services." >&2
    return 1
  fi
  printf '%s' "${value}"
}

verify_key_file() {
  local key="${ETC_ROOT}/keys/ecommerce.pem"
  if [[ ! -f "${key}" ]]; then
    echo "${key} is missing; place the dedicated control-to-ecommerce SSH key there." >&2
    return 1
  fi

  chown "${SERVICE_USER}:${SERVICE_GROUP}" "${key}"
  chmod 0600 "${key}"

  local owner mode
  owner="$(stat -c '%U:%G' "${key}")"
  mode="$(stat -c '%a' "${key}")"
  if [[ "${owner}" != "${SERVICE_USER}:${SERVICE_GROUP}" || "${mode}" != "600" ]]; then
    echo "${key} must be owned by ${SERVICE_USER}:${SERVICE_GROUP} with 0600 (found ${owner} ${mode})." >&2
    return 1
  fi
  echo "SSH key verified: ${key} (${owner} ${mode})"
}

verify_known_hosts() {
  local known="${ETC_ROOT}/keys/known_hosts"
  if [[ ! -s "${known}" ]]; then
    echo "${known} is missing; pin the ecommerce host key first:" >&2
    echo "  sudo ssh-keyscan -t ed25519 <EC2_HOST> | sudo tee ${known}" >&2
    return 1
  fi

  chown "${SERVICE_USER}:${SERVICE_GROUP}" "${known}"
  chmod 0600 "${known}"
  echo "known_hosts verified: ${known} (owned by ${SERVICE_USER}, 0600)"
}

normalize_fingerprint() {
  local value="$1"
  # ':' never appears inside a base64 body, so repeated prefixes are safe to strip.
  while [[ "${value}" == SHA256:* ]]; do
    value="${value#SHA256:}"
  done
  value="${value%%=*}"
  printf '%s' "${value}"
}

verify_host_key_fingerprint() {
  check_env_required "EC2_HOST_KEY_SHA256" >/dev/null
  local expected actual
  expected="$(normalize_fingerprint "$(check_env_required EC2_HOST_KEY_SHA256)")"
  actual="$(ssh-keygen -lf "${ETC_ROOT}/keys/known_hosts" 2>/dev/null | head -n 1 | awk '{print $2}')"
  if [[ -z "${actual}" ]]; then
    echo "Could not read a fingerprint from ${ETC_ROOT}/keys/known_hosts." >&2
    return 1
  fi

  actual="$(normalize_fingerprint "${actual}")"
  if [[ "${expected}" != "${actual}" ]]; then
    echo "Host key fingerprint mismatch: EC2_HOST_KEY_SHA256=${expected}, known_hosts=${actual}" >&2
    echo "Re-pin the host key and update EC2_HOST_KEY_SHA256 before starting services." >&2
    return 1
  fi
  echo "Host key fingerprint verified: SHA256:${actual}"
}

validate_env_for_start() {
  check_env_required "GATEWAY_URL" >/dev/null
  check_env_required "GATEWAY_ADMIN_TOKEN" >/dev/null
  check_env_required "SIM_ADMIN_IDENTITIES" >/dev/null
  check_env_required "EC2_HOST" >/dev/null
  verify_key_file
  verify_known_hosts
  verify_host_key_fingerprint
}

enable_services() {
  if [[ "${START_SERVICES}" != "1" ]]; then
    echo "Skipping service start (set START_SERVICES=1 to start now)."
    echo "After filling in ${ENV_FILE} and ${ETC_ROOT}/keys, run:"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now prometheus sim-metrics-tunnel live-twin caddy"
    return
  fi

  validate_env_for_start
  systemctl enable --now caddy
  systemctl enable --now prometheus
  systemctl enable --now sim-metrics-tunnel
  systemctl enable --now live-twin
  systemctl restart caddy
  systemctl restart prometheus
  systemctl restart sim-metrics-tunnel
  systemctl restart live-twin
}

require_root
verify_arch
install_base_tools
install_node22
install_k6
install_caddy
install_prometheus
install_cloudflared
create_service_account
copy_sources
ensure_env_template
configure_prometheus
configure_caddy
install_service
configure_app
enable_services

echo "Control EC2 bootstrap complete."
echo "Update ${ENV_FILE} with the gateway, admin, and SSH values before public exposure."
echo "Create ${ETC_ROOT}/keys/ecommerce.pem (0600, owned by ${SERVICE_USER}), pin the host key in ${ETC_ROOT}/keys/known_hosts, and set EC2_HOST_KEY_SHA256."
echo "Review ${LIVE_TWIN_SERVICE}, ${CADDYFILE}, and ${ETC_ROOT}/prometheus.yml after deployment."
