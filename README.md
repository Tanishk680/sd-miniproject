# E-Commerce Microservices with Custom L7 API Gateway

Microservices-based e-commerce application with a custom Layer-7 API Gateway (Node.js/Express) and React frontend.

## Architecture

```
Browser → localhost:3000 (nginx) ─┬─ /api/* → localhost:5000 (Gateway) ─┬─ /api/users/*  → user-service:5001
                                  │                                    ├─ /api/products/* → product-service:5002
                                  │                                    └─ /api/orders/*  → order-service:5003
                                  └─ /*  → React SPA (static files)          └─ MongoDB (3 containers)
```

## Components

| Component | Tech | Port | Health |
| --------- | ---- | ---- | ------ |
| React Web App | React 18 + Vite 5 + nginx 1.27 | 3000 | `GET /` |
| Custom API Gateway | Node.js + Express | 5000 | `GET /health` |
| User Service | Node.js + Express + Mongoose | 5001 | `GET /health` |
| Product Service | Node.js + Express + Mongoose | 5002 | `GET /health` |
| Order Service | Node.js + Express + Mongoose | 5003 | `GET /health` |
| MongoDB (User/Product/Order) | mongo:7 | internal | `mongosh ping` |

## Quick start

```bash
docker compose up --build
```

Open http://localhost:3000 in your browser.

## Gateway features

- **L7 reverse proxy** — http-proxy-middleware routes `/api/users/*`, `/api/products/*`, `/api/orders/*` to their respective microservices
- **JWT verification** — validates Bearer tokens on `auth:true` routes; injects `X-User-Id` header to downstream services
- **Sliding-window rate limiting** — 100 requests per 60s per IP; returns `Retry-After` and `X-RateLimit-*` headers on 429
- **Health monitoring** — polls each backend every 10s; marks HEALTHY/UNHEALTHY with transition logging
- **Dynamic config reload** — `POST /gateway/reload` re-reads `routes.json`; rejects invalid configs while keeping the previous working table
- **Metrics** — counters by route and status, average latency, uptime; `GET /gateway/metrics`

## Gateway endpoints (bypass rate limit/auth)

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/health` | GET | Gateway liveness check |
| `/gateway/status` | GET | Routes, backends, rate-limit config, last error |
| `/gateway/reload` | POST | Re-read and apply `routes.json` |
| `/gateway/metrics` | GET | Request counters, latency, uptime |

## API endpoints (through gateway at `localhost:5000`)

### User Service
- `POST /api/users/register` — body `{ username, email, password }` → 201 + token
- `POST /api/users/login` — body `{ username, password }` → 200 + token
- `GET  /api/users/profile` — header `Authorization: Bearer <token>` → 200

### Product Service
- `GET /api/products` — optional `?category=`
- `GET /api/products/search?q=...`
- `GET /api/products/:id`

### Order Service
- `POST /api/orders` — body `{ items: [{ productId, quantity }] }` (authenticated; name/price re-fetched from the product service, client values ignored)
- `GET  /api/orders` — authenticated, own orders only
- `GET  /api/orders/:id` — authenticated, own order only

## Configuration

| Env var | Default | Purpose |
| ------- | ------- | ------- |
| `JWT_SECRET` | `dev-insecure-jwt-secret-change-me` | Shared secret for signing/verifying JWTs |

## Project structure

```
├── docker-compose.yml
├── .env.example
├── services/
│   ├── user-service/
│   ├── product-service/      (auto-seeds 12 products)
│   └── order-service/
├── gateway/
│   └── src/
│       ├── config/           (routes.json, schema.js, configLoader.js)
│       ├── services/         (proxy.js, healthChecker.js, secretManager.js)
│       └── middleware/        (auth.js, rateLimiter.js, metrics.js)
├── frontend/
│   ├── src/
│   │   ├── api/client.js     (fetch wrapper)
│   │   ├── auth/AuthContext.jsx
│   │   ├── pages/            (Login, Register, ProductList, ProductDetail, PlaceOrder, OrderHistory)
│   │   └── components/       (Navbar, ProtectedRoute)
│   └── nginx.conf
└── docs/
    ├── postman_collection.json
    └── load-test.js          (k6 load test)
```

## Load testing

```bash
# Requires k6 installed: https://k6.io
k6 run docs/load-test.js
```

## Resilience demo

```bash
# 1. Stop a service → 503 for that route, others unaffected
docker compose stop product-service
curl http://localhost:5000/api/products        # 503
curl http://localhost:5000/api/users/profile    # 200

# 2. Restart → automatic recovery
docker compose start product-service
curl http://localhost:5000/api/products        # 200

# 3. Config reload (edit routes.json, then trigger)
curl -X POST http://localhost:5000/gateway/reload
```
