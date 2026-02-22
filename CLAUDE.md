# LocTrec — Cyclist Event Tracking Platform

## Project Overview

Real-time cyclist tracking during events. Monorepo with 3 backend services + 1 client SDK.

## Architecture

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `services/auth` | TypeScript/Bun | 8081 | Authentication & user management |
| `services/events` | TypeScript/Bun | 8082 | Event CRUD, registrations |
| `services/tracker` | Go | 8083 | WebSocket server, live location |
| `packages/client-sdk` | TypeScript | — | Generic JS/TS client library |

- **Ingress**: Istio Gateway + VirtualServices (routes `/api/auth/*`, `/api/events/*`, `/api/tracker/*`)
- **Database**: PostgreSQL (shared instance, separate schemas `auth.*` and `events.*`)
- **Cache**: Redis
- **IPC**: HTTP/REST between services
- **WebSocket**: Raw protocol (no Socket.IO)
- **User roles**: Rider, Organizer

## Development

### Prerequisites
- [Go 1.23+](https://go.dev) (tracker service)
- [Docker](https://docker.com) (building images, Kind cluster)
- All other tools (Bun, golangci-lint, Kind, kubectl, Helm, istioctl, Skaffold) install automatically to `./bin/` via `make tools`

### Common Commands
```bash
make tools           # Install all dev tools to ./bin/
make cluster-up      # Create Kind cluster + bootstrap (Istio, cert-manager, Postgres, Redis)
make cluster-down    # Delete Kind cluster
make dev             # Skaffold dev loop (build + deploy + watch)
make deploy          # Skaffold run (build + deploy once)
make build           # Build all services
make test            # Test all services
make lint            # Lint all services (includes format check)
make format          # Auto-format all services
make helm-lint       # Lint all Helm charts
make docker-build    # Build all Docker images
```

### Per-service Commands
```bash
make build-<service>   # Build one service (auth|events|tracker|sdk)
make test-<service>    # Test one service
make lint-<service>    # Lint one service
make format-<service>  # Format one service
```

### TypeScript Services (auth, events)
- Runtime: Bun
- Linter/Formatter: Biome (`bun run lint`, `bun run format`)
- Tests: `bun test`
- Each service has its own `package.json`, `tsconfig.json`, `biome.json`

### Go Service (tracker)
- Linter: golangci-lint (`.golangci.yml`)
- Tests: `go test ./...`
- Build: `go build ./cmd/tracker`

### Client SDK
- TypeScript package in `packages/client-sdk/`
- Generic (works in Node.js, browsers, React Native)
- Same tooling as TS services (Biome, Bun)

### Kubernetes
- Local dev cluster via Kind (`make cluster-up`)
- Istio service mesh handles ingress routing and mTLS
- Per-service Helm charts in `charts/`
- Skaffold for build/deploy dev loop
- Infrastructure versions pinned in `tools.mk`
- All K8s targets include an AKS safety guard — they refuse to run against AKS clusters

## Conventions
- Each service is self-contained with its own dependencies
- All services expose `GET /health` for health checks
- Environment variables for configuration (ports, DB URLs, service URLs)
- No cross-service imports; communicate only via HTTP/WebSocket
