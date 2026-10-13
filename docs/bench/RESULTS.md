# Benchmark Results

Profile (unless noted): **10 VUs**, `read`/`auth-write` stages 30s ramp + 120s steady + 10s down
with `sleep(1)` per iteration; `mixed` reuses `docs/load-test.js` (10s/30s/5s, `sleep(0.5)`).
Rate limit during runs: 5000 req/60s/IP (single k6 machine, well under the ceiling).
Envs: **local** = Docker Desktop on a Windows dev laptop; **ec2** = `t3.small`
(2 vCPU, 2 GB) in `us-east-1`, k6 driven cross-region (client IST — adds baseline RTT).
Raw JSON per run lives next to this file (`<tag>-<scenario>-summary.json`,
`-console.txt`, `-metrics-*.json`, `-docker-stats.txt`).

## Layer 1 — Endpoint latency / throughput (10 VUs)

| Scenario | Env | Reqs | Fail | med | p90 | p95 | max |
|---|---|---|---|---|---|---|---|
| read (list+search+detail) | local | 3786 | 0.00% | 22.5 | 78.1 | 110.0 | 552.4 |
| read | ec2 | 935 | 0.32%* | 288.8 | 393.2 | 418.4 | 2364.0 |
| auth-write (profile+order+history, pre-registered tokens) | local | 2736 | 0.29%† | 82.5 | 345.6 | 489.5 | 6842.2 |
| auth-write | ec2 | 1059 | 0.38%* | 224.0 | 260.9 | 293.8 | 631.9 |
| mixed (end-to-end incl. register/login per iteration) | local run 1 | 510 | 0.00% | 144.6 | 2458.3 | 3171.7‡ | 6162.3 |
| mixed | local rerun | 870 | 0.00% | 42.9 | 1452.8 | 1912.1 | 4016.8 |

\* EC2 failures are TCP `connectex` blips (SYN timeouts on the public path), not app
errors — every completed HTTP check passed (`ec2-read-summary.json`,
`ec2-auth-write-summary.json`). Client is cross-region, which also explains the
higher EC2 medians (~200–300 ms baseline RTT vs ~20–80 ms loopback).

† Local auth-write shows 8 fast-fail **503s** in gateway metrics mid-run
(`local-auth-write-metrics-after.json`): a backend briefly read UNHEALTHY under write
load and the fail-closed gate rejected without touching the network; all recovered
without intervention. Honest wart, matches the design.

‡ Mixed run 1 crossed the `p(95)<2000` threshold; rerun passed at 1912 ms. The mixed
script registers+bcrypt-hashes a user **per iteration**, so it measures end-to-end flow
(incl. bcrypt ≈100 ms+/register and DB growth across runs), not gateway throughput.
Takeaway: use read/auth-write for gateway numbers, mixed for capacity smoke.

Gateway self-metrics cross-check (`local-read-metrics-*.json`): 87 → 3873 requests,
avg latency 69 → 21 ms (JIT/cache warm-up visible across the run).

## Layer 2 — Gateway overhead (direct vs proxied, local)

Same catalog query, 6 samples each (first = cold):

| Path | Samples (ms) |
|---|---|
| Direct: container → `product-service:5002` (no gateway) | 141, 22, 9, 13, 14, 17 |
| Via gateway: host → `localhost:5000` (full L7 pipeline) | 192, 10.6, 10.8, 10.6, 16.6, 12.1 |

Steady-state medians both ≈ 10–15 ms — **L7 overhead (route match + auth skip on public
route + proxy) is within measurement noise on loopback**. No overclaim: this bounds
overhead at single-digit ms; it does not profile each middleware stage.

EC2 layer-2 (box-side, owner-run 2026-10-14, idle box):

| Path | Samples (ms) |
|---|---|
| Direct: gateway container → `product-service:5002` | 167, 12, 8, 7, 6, 6 |
| Via gateway: box → `localhost:5000` | 24.2, 5.8, 4.6, 5.1, 7.1, 4.9 |

Same verdict on EC2 hardware (steady medians ≈ 5–8 ms both paths; first samples are
cold-start/JIT). The gateway adds no measurable latency at this scale.

## Layer 3 — Failure timing (local)

`docker compose stop product-service` → 10/10 `GET /api/products` → **503 in 6–26 ms**
(`local-L3-503-timings.txt` — fail-closed rejects before any network I/O); login on
user-service simultaneously **200 in 0.39 s** (isolation holds). `start` →
first 200 after **2.3 s** (`local-L3-recovery.txt`, warm container + one health cycle).
EC2 layer-3: same procedure on the box (optional) — commands in "Box-side bundle".

## Layer 4 — Resource footprint, steady state (local)

Read run (`local-read-docker-stats.txt`):

| Container | CPU% | MEM |
|---|---|---|
| gateway | 24.2 | 78 MB |
| product-service | 15.7 | 102 MB |
| mongo-product/user/order | 4.0 / 1.0 / 82* | ~213–225 MB each |
| user/order-service, frontend | <1 | 63–73 MB / 6 MB |

Auth-write run (`local-auth-write-docker-stats.txt`):

| Container | CPU% | MEM |
|---|---|---|
| gateway | 42.0 | 78 MB |
| order-service | 55.6 | 104 MB |
| product-service | 50.9 | 71 MB |
| user-service | 13.9 | 78 MB |
| mongo-order | 33.1 | 227 MB |
| mongo-user/product | ~1.2 | ~214 MB |

\* `mongo-order` 82% in the read run is a single-snapshot compaction/checkpoint spike
(no order writes in that scenario); it sat at 33% in the write run. Single snapshots
are indicative, not profiles. Node services sit ~60–105 MB — the 512 MB prod limits
have ~5× headroom.

EC2 layer-4 (box-side idle snapshot, owner-run 2026-10-14 — baseline footprint, not
under load; `t3.small` = 2 GB total):

| Container | CPU% | MEM / LIMIT |
|---|---|---|
| gateway | 0.03 | 50 MB / 512 MB |
| user / product / order-service | 0.09–0.10 | 48–57 MB / 512 MB |
| mongo ×3 | 0.43–0.46 | 106–118 MB / 1.9 GB (unlimited) |
| frontend | 0.00 | 3.8 MB |

Idle total ≈ 430 MB of 2 GB — comfortable headroom, and the LIMIT column confirms the
prod compose resource limits are enforced on EC2. Under-load EC2 profiling would need
a coordinated k6 run; the local steady-state table above stands in for the shape.

## Box-side bundle — COMPLETED 2026-10-14 (outputs above, EC2 synced to `4d652e6`)

<details><summary>Original commands (for reproducibility)</summary>

```bash
cd ~/miniproject
# L2: direct (no gateway) vs proxied, 6 samples each
docker compose -f docker-compose.prod.yml exec gateway node -e "(async()=>{for(let i=0;i<6;i++){const t=Date.now();const r=await fetch('http://product-service:5002/api/products');await r.text();console.log(((Date.now()-t)/1000).toFixed(6)+' '+r.status)}})()"
for i in 1 2 3 4 5 6; do curl -o /dev/null -s -w "%{time_total} %{http_code}\n" http://localhost:5000/api/products; done
# L4: resource snapshot (ideally while `read.js` k6 runs against the public IP)
docker compose -f docker-compose.prod.yml exec gateway env >/dev/null && docker stats --no-stream
# L3 (optional): time 503s across a product-service stop/start like Layer 3 above
```

</details>

EC2 `mixed` was deliberately skipped remotely: it needs the admin token and its
per-iteration bcrypt dominates the number — local mixed already characterizes it.

## Reproduce

```powershell
# local, 10 VUs (needs local .env admin token for metrics snapshots):
.\docs\bench\run-bench.ps1 -Scenario read|auth-write|mixed -BaseUrl http://localhost:5000 -AdminToken <token> -Tag local
# ec2 (no box access needed; metrics snapshots will 403 without the token):
.\docs\bench\run-bench.ps1 -Scenario read|auth-write -BaseUrl http://<EC2-IP>:5000 -Tag ec2 -SkipDockerStats
```
