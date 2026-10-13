# Benchmark runner: one scenario at a time with gateway metrics + docker stats capture.
# Usage (project root):
#   .\docs\bench\run-bench.ps1 -Scenario read -BaseUrl http://localhost:5000 -AdminToken <token> -Tag local
#   .\docs\bench\run-bench.ps1 -Scenario read -BaseUrl http://54.81.34.210:5000 -AdminToken <token> -Tag ec2 -SkipDockerStats
# Scenarios: read | auth-write | mixed  (mixed reuses docs/load-test.js end-to-end flow)
param(
  [Parameter(Mandatory = $true)][ValidateSet('read', 'auth-write', 'mixed')][string]$Scenario,
  [string]$BaseUrl = 'http://localhost:5000',
  [string]$AdminToken = '',
  [string]$Tag = 'local',
  [string]$OutDir = 'docs/bench/results',
  [switch]$SkipDockerStats,
  [int]$MidAtSeconds = 100
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$script = if ($Scenario -eq 'mixed') { 'docs/load-test.js' } else { "docs/bench/$Scenario.js" }
$prefix = "$OutDir/${Tag}-${Scenario}"
$adminH = @()
if ($AdminToken -ne '') { $adminH = @('-H', "X-Admin-Token: $AdminToken") }

Write-Output "=== [$Tag/$Scenario] metrics-before"
curl.exe -s "$BaseUrl/gateway/metrics" @adminH | Out-File -Encoding utf8 "$prefix-metrics-before.json"

Write-Output "=== [$Tag/$Scenario] k6 start"
$summary = "$prefix-summary.json"
$proc = Start-Process k6 -ArgumentList @('run', "-e", "BASE_URL=$BaseUrl", '-e', "ADMIN_TOKEN=$AdminToken", '-e', "SUMMARY_FILE=$summary", $script) -NoNewWindow -PassThru -RedirectStandardOutput "$prefix-console.txt"

Start-Sleep -Seconds $MidAtSeconds
if (-not $SkipDockerStats) {
  Write-Output "=== [$Tag/$Scenario] docker stats (steady state)"
  docker stats --no-stream 2>&1 | Out-File -Encoding utf8 "$prefix-docker-stats.txt"
}
Write-Output "=== [$Tag/$Scenario] metrics-mid"
curl.exe -s "$BaseUrl/gateway/metrics" @adminH | Out-File -Encoding utf8 "$prefix-metrics-mid.json"

$proc | Wait-Process
Write-Output "=== [$Tag/$Scenario] metrics-after"
curl.exe -s "$BaseUrl/gateway/metrics" @adminH | Out-File -Encoding utf8 "$prefix-metrics-after.json"
Write-Output "=== [$Tag/$Scenario] done -> $prefix-*"
