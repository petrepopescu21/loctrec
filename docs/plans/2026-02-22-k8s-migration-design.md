# Docker Compose to Kubernetes Migration

## Context

Replace docker-compose with a local Kubernetes dev environment using Kind, Istio, and Helm. Istio replaces the gateway service entirely via VirtualService routing. The gateway service is removed from the project.

## Decisions

- **Kind** for local cluster
- **Istio** for service mesh + ingress (replaces gateway service)
- **cert-manager** for TLS certificate management
- **Bitnami Helm charts** for PostgreSQL and Redis
- **Per-service Helm charts** for auth, events, tracker
- **Skaffold** for build/deploy dev loop
- **AKS safety guard**: all K8s targets check node names for AKS and exit early if detected
- **Idempotent cluster-create**: deletes existing Kind cluster before creating

## Removed

- `docker-compose.yml`
- `services/gateway/` (entire directory, Dockerfile, Makefile targets, CI references)

## Added

### Tools (in `./bin/` via `tools.mk`)
- kind, kubectl, helm, istioctl, skaffold

### Files
```
k8s/
├── kind-config.yaml
└── bootstrap/
    ├── istio.sh
    ├── cert-manager.sh
    ├── postgres-values.yaml
    └── redis-values.yaml
charts/
├── auth/           (Chart.yaml, values.yaml, templates/)
├── events/         (Chart.yaml, values.yaml, templates/)
└── tracker/        (Chart.yaml, values.yaml, templates/)
skaffold.yaml
```

### Makefile targets
- `make cluster-create` — delete existing + create Kind cluster + bootstrap
- `make cluster-bootstrap` — install Istio, cert-manager, Postgres, Redis
- `make deploy` — `skaffold run`
- `make dev` — `skaffold dev`

### Istio routing
- `/api/auth/*` → auth:8081
- `/api/events/*` → events:8082
- `/api/tracker/*` → tracker:8083
