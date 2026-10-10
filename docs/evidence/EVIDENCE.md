# Test Evidence Bundle

Captured **2026-10-10** against the local Docker stack (`docker compose up --build -d`,
branch `hardening/gateway-security`). Gateway at `http://localhost:5000`, frontend at
`http://localhost:3000`. Admin endpoints use `X-Admin-Token` (dev value
`change-me-admin-token` from gitignored `.env`). Bearer tokens in saved files are
redacted to `REDACTED`.

## How to reproduce

```bash
docker compose up --build -d
# wait ~30s for healthchecks, then e.g.:
curl http://localhost:5000/health
curl -H "X-Admin-Token: $GATEWAY_ADMIN_TOKEN" http://localhost:5000/gateway/status
# k6 (requires ADMIN_TOKEN since gateway hardening):
k6 run -e BASE_URL=http://localhost:5000 -e ADMIN_TOKEN=<token> \
  -e SUMMARY_FILE=docs/evidence/19-k6-summary.json docs/load-test.js
# Postman: import docs/postman_collection.json (set adminToken variable)
```

## Results

| # | File | What it proves | Result |
|---|---|---|---|
| 01 | `01-gateway-health.json` | Gateway liveness | `{status: ok}` |
| 02 | `02-gateway-status.json` | 3 routes loaded, all backends HEALTHY | ok |
| 03 | `03-register-201.json` | Registration issues JWT | 201 |
| 04 | `04-profile-401-no-token.txt` | No token rejected | 401 |
| 05 | `05-profile-401-forged.json` | Forged JWT rejected | 401 Invalid token |
| 06 | `06-profile-200.json` | Valid JWT reaches service | 200 |
| 07 | `07-products-books.json` | Category filter via gateway | 200 |
| 08 | `08-order-valid-201.json` | Order total from catalog (89.99×1) | 201 |
| 09 | `09-order-tampered-catalog-price.json` | `{price: 1, name: HACKED}` → stored at catalog 89.99 | tamper neutralized |
| 10 | `10-order-unknown-product-400.json` | Unknown productId | 400 Invalid product |
| 11 | `11-resilience-product-down-503.json` | `docker compose stop product-service` → 503; login still 200 (isolation) | ok |
| 12 | `12-recovery-200.txt` | `docker compose start product-service` → 200 | ok |
| 13 | `13-reload-403-no-token.txt` | Reload without admin token | 403 |
| 14 | `14-reload-200-with-token.json` | Reload with admin token | `ok: true` |
| 15 | `15-metrics.json` | totals / by-route / by-status / avg latency | ok |
| 16 | `16-ratelimit-burst-8-with-max-5.txt` | Temp limit max=5: burst of 8 | `200×5 then 429×3` |
| 17 | `17-ratelimit-429-headers.txt` | 429 carries `Retry-After: 59`, `X-RateLimit-Limit: 5` | ok |
| 18 | `18-reload-invalid-config-rejected.json` | Bad target → 400, previous routes kept, still serving 200 | fail-safe config |
| 19 | `19-k6-summary.json` | 10 VUs × 45 s: 990 reqs, 0.00% fail, p95 1302 ms (< 2000 threshold: ok) | pass |

Notes:
- The rate-limit demo (16–17) used a temporary `max: 5` + `POST /gateway/reload`; the
  original `max: 5000` config was restored and reloaded afterwards (`routes.json`
  byte-identical, `git status` clean for that file).
- k6 registers a fresh user per iteration, so it measures the end-to-end flow
  (auth + browse + order), not pure gateway throughput — see review doc §14.
