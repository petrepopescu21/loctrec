# LocTrec

Real-time cyclist tracking during events. Riders share their live location via WebSocket; organizers create and manage events.

## Architecture

| Service | Language | Purpose |
|---------|----------|---------|
| `services/auth` | TypeScript/Bun | Authentication and user management |
| `services/events` | TypeScript/Bun | Event CRUD and registrations |
| `services/tracker` | Go | WebSocket server for live location |
| `packages/client-sdk` | TypeScript | Generic JS/TS client library |

Services run in a local Kubernetes cluster (Kind) with Istio handling ingress routing. PostgreSQL and Redis are deployed via Bitnami Helm charts.

## Prerequisites

You need two things installed on your machine:

- [Go 1.23+](https://go.dev)
- [Docker](https://docker.com)

Everything else (Bun, Kind, kubectl, Helm, istioctl, Skaffold, golangci-lint) is installed automatically into the project's `./bin/` directory when you run `make tools`. Nothing is installed globally.

Works on macOS and WSL (Linux).

## Quick Start

```bash
# 1. Install all dev tools locally
make tools

# 2. Install TypeScript dependencies
make install

# 3. Create a Kind cluster with Istio, cert-manager, PostgreSQL, and Redis
make cluster-up

# 4. Build and deploy all services (with file watching)
make dev
```

Services are accessible through the Istio ingress gateway on port 80:

```
http://localhost/api/auth/health
http://localhost/api/events/health
http://localhost/api/tracker/health
```

To deploy once without file watching, use `make deploy` instead of `make dev`.

## Common Commands

```bash
make tools           # Install all dev tools to ./bin/
make install         # Install TypeScript dependencies
make cluster-up      # Create Kind cluster + bootstrap everything
make cluster-down    # Delete the Kind cluster
make dev             # Skaffold dev loop (build + deploy + file watch)
make deploy          # Build and deploy once
make build           # Build all services locally
make test            # Run all tests
make lint            # Lint all services
make format          # Auto-format all services
make helm-lint       # Lint Helm charts
make docker-build    # Build Docker images
make clean           # Remove build artifacts
make tools-clean     # Remove all tools from ./bin/
```

### Per-Service

Replace `<service>` with `auth`, `events`, `tracker`, or `sdk`:

```bash
make build-<service>
make test-<service>
make lint-<service>
make format-<service>
```

## Project Structure

```
loctrec/
├── services/
│   ├── auth/              # TypeScript/Bun
│   ├── events/            # TypeScript/Bun
│   └── tracker/           # Go
├── packages/
│   └── client-sdk/        # TypeScript
├── charts/
│   ├── auth/              # Helm chart
│   ├── events/            # Helm chart
│   └── tracker/           # Helm chart
├── k8s/
│   ├── kind-config.yaml   # Kind cluster config
│   ├── gateway.yaml       # Istio Gateway
│   └── bootstrap/         # Helm values for Postgres, Redis
├── Makefile               # All build/test/deploy targets
├── tools.mk               # Tool installation and version pinning
└── skaffold.yaml          # Skaffold build/deploy config
```

## Cluster Bootstrap

`make cluster-up` provisions a complete local environment:

1. Creates a Kind cluster with ingress port mappings (80, 443)
2. Installs Istio (base, istiod, ingress gateway) via Helm
3. Enables Istio sidecar injection in the default namespace
4. Installs cert-manager via Helm
5. Deploys PostgreSQL (Bitnami Helm chart)
6. Deploys Redis (Bitnami Helm chart)
7. Applies the Istio Gateway resource

All infrastructure versions are pinned in `tools.mk`.

Running `make cluster-up` again is safe — it deletes and recreates the cluster from scratch.

## Safety

All Kubernetes Makefile targets check for AKS in the cluster node names and refuse to run if detected. This prevents accidentally running dev tooling against a production cluster.
