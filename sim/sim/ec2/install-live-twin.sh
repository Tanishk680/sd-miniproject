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
FORCE="${FORCE:-0}"
ENABLE_CLOUDFLARED="${ENABLE_CLOUDFLARED:-0}"

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

require_tool() {
  local tool="$1"
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Required tool is missing: ${tool}" >&2
    return 1
  fi
}

install_base_tools() {
  dnf install -y curl ca-certificates git unzip tar gcc gcc-c++ make rsync
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

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    echo "Caddy already installed"
    return
  fi

  dnf install -y yum-utils
  dnf config-manager --set-enabled crb
  dnf install -y caddy
}

create_service_account() {
  if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd --system --home-dir /opt/sim --create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
  fi

  install -d "${APP_ROOT}" "${SERVER_ROOT}" "${UI_ROOT}" "${DATA_ROOT}" "${ETC_ROOT}"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_ROOT}" "${DATA_ROOT}"
  chmod 0750 "${ETC_ROOT}"
}

copy_sources() {
  install -d "${SERVER_ROOT}" "${UI_ROOT}"
  rsync -a --delete "${REPO_PATH}/sim/server/" "${SERVER_ROOT}/"
  rsync -a --delete "${REPO_PATH}/sim/ui/" "${UI_ROOT}/"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${SERVER_ROOT}" "${UI_ROOT}"
}

ensure_env_template() {
  local env_template="${REPO_PATH}/sim/server/.env.example"
  if [[ ! -f "${env_template}" ]]; then
    echo "Missing env template: ${env_template}" >&2
    exit 1
  fi

  if [[ ! -f "${ENV_FILE}" || "${FORCE}" == "1" ]]; then
    cp "${env_template}" "${ENV_FILE}"
  fi

  chmod 0600 "${ENV_FILE}"
  chown "${SERVICE_USER}:${SERVICE_GROUP}" "${ENV_FILE}"
}

configure_caddy() {
  if [[ -f "${CADDYFILE}" && "${FORCE}" != "1" ]]; then
    echo "Keeping existing Caddy file: ${CADDYFILE}"
    return
  fi

  cp "${REPO_PATH}/sim/ui/Caddyfile" "${CADDYFILE}"
  chown root:root "${CADDYFILE}"
  chmod 0644 "${CADDYFILE}"
}

install_service() {
  if [[ -f "${LIVE_TWIN_SERVICE}" && "${FORCE}" != "1" ]]; then
    echo "Keeping existing live-twin service definition: ${LIVE_TWIN_SERVICE}"
    return
  fi

  cp "${REPO_PATH}/sim/ec2/live-twin.service" "${LIVE_TWIN_SERVICE}"
  chmod 0644 "${LIVE_TWIN_SERVICE}"
  systemctl daemon-reload
}

configure_app() {
  cd "${UI_ROOT}"
  npm ci --include=dev
  npm run build

  cd "${SERVER_ROOT}"
  npm ci --include=dev

  mkdir -p "${SERVER_ROOT}/data"
  chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${SERVER_ROOT}/data"
}

enable_services() {
  systemctl enable --now caddy
  systemctl enable --now live-twin
  systemctl restart caddy
  systemctl restart live-twin
}

require_root
install_base_tools
install_node22
install_k6
install_caddy
install_cloudflared
create_service_account
copy_sources
ensure_env_template
configure_caddy
install_service
configure_app
enable_services

echo "Control EC2 bootstrap complete."
echo "Update ${ENV_FILE} with the gateway and admin values before public exposure."
echo "Review ${LIVE_TWIN_SERVICE} and ${CADDYFILE} after deployment."
