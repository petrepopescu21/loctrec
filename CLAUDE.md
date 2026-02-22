# LocTrec — Cyclist Event Tracking Platform

## Project Overview

Real-time cyclist tracking during events. Monorepo with 4 backend services + 1 client SDK.

## Architecture

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `services/gateway` | TypeScript/Bun | 8080 | API gateway, routes to internal services |
| `services/auth` | TypeScript/Bun | 8081 | Authentication & user management |
| `services/events` | TypeScript/Bun | 8082 | Event CRUD, registrations |
| `services/tracker` | Go | 8083 | WebSocket server, live location |
| `packages/client-sdk` | TypeScript | — | Generic JS/TS client library |

- **Database**: PostgreSQL (shared instance, separate schemas `auth.*` and `events.*`)
- **IPC**: HTTP/REST between services
- **WebSocket**: Raw protocol (no Socket.IO)
- **User roles**: Rider, Organizer

## Development

### Prerequisites
- [Bun](https://bun.sh) (TS services runtime + package manager)
- [Go 1.23+](https://go.dev) (tracker service)
- [Docker](https://docker.com) + Docker Compose
- [golangci-lint](https://golangci-lint.run) (Go linting)

### Common Commands
```bash
make build          # Build all services
make test           # Test all services
make lint           # Lint all services (includes format check)
make format         # Auto-format all services
make docker-build   # Build all Docker images
make docker-up      # Start all services via docker compose
make docker-down    # Stop all services
```

### Per-service Commands
```bash
make build-<service>   # Build one service (gateway|auth|events|tracker|sdk)
make test-<service>    # Test one service
make lint-<service>    # Lint one service
make format-<service>  # Format one service
```

### TypeScript Services (gateway, auth, events)
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

## Conventions
- Each service is self-contained with its own dependencies
- All services expose `GET /health` for health checks
- Environment variables for configuration (ports, DB URLs, service URLs)
- No cross-service imports; communicate only via HTTP/WebSocket
