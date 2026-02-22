# Kubernetes Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace docker-compose with Kind + Istio + Helm + Skaffold; remove gateway service (Istio replaces it); add local tool management for all K8s tools.

**Architecture:** Kind cluster with Istio service mesh handling ingress routing via VirtualServices. Bitnami Helm charts for Postgres/Redis. Per-service Helm charts for auth, events, tracker. Skaffold for build/deploy dev loop. AKS safety guard on all K8s targets.

**Tech Stack:** Kind, kubectl, Helm, Istio, cert-manager, Skaffold, Bitnami Postgres/Redis charts

---

### Task 1: Remove gateway service and docker-compose

**Files:**
- Delete: `services/gateway/` (entire directory)
- Delete: `docker-compose.yml`
- Modify: `Makefile`
- Modify: `CLAUDE.md`
- Modify: `.github/workflows/lint.yml`
- Modify: `.github/workflows/test.yml`
- Modify: `.gitignore`

**Step 1: Delete gateway directory and docker-compose**

```bash
rm -rf services/gateway
rm docker-compose.yml
```

**Step 2: Update Makefile — remove gateway targets, docker-compose targets**

Remove from `TS_SERVICES`:
```makefile
TS_SERVICES := services/auth services/events packages/client-sdk
```

Remove these targets entirely: `build-gateway`, `test-gateway`, `lint-gateway`, `format-gateway`, `docker-build-gateway`, `docker-up`, `docker-down`.

Remove `gateway` from aggregate targets: `build`, `test`, `lint`, `format`, `docker-build`.

Remove from `clean`:
```makefile
clean:
	rm -rf services/auth/dist
	rm -rf services/events/dist
	rm -rf services/tracker/bin
	rm -rf packages/client-sdk/dist
```

**Step 3: Update CI workflows — remove gateway from matrix**

In `.github/workflows/lint.yml` and `.github/workflows/test.yml`, remove `- services/gateway` from the matrix.

**Step 4: Update CLAUDE.md**

Remove gateway row from architecture table. Remove Docker Compose references. Update commands section.

**Step 5: Verify**

```bash
make lint
make build
```
Expected: both pass with no gateway references.

**Step 6: Commit**

```bash
git add -A
git commit -m "remove gateway service and docker-compose

Istio will handle ingress routing via VirtualServices."
```

---

### Task 2: Add K8s tools to tools.mk

**Files:**
- Modify: `tools.mk`

**Step 1: Add tool versions and binaries**

Add after `GOLANGCI_VERSION` line:

```makefile
KIND_VERSION      := 0.27.0
KUBECTL_VERSION   := 1.32.3
HELM_VERSION      := 3.17.1
ISTIO_VERSION     := 1.24.3
SKAFFOLD_VERSION  := 2.14.0
```

Add after `GOLANGCI` line:

```makefile
KIND      := $(TOOLS_BIN)/kind
KUBECTL   := $(TOOLS_BIN)/kubectl
HELM      := $(TOOLS_BIN)/helm
ISTIOCTL  := $(TOOLS_BIN)/istioctl
SKAFFOLD  := $(TOOLS_BIN)/skaffold
```

**Step 2: Add OS/ARCH detection**

Add after the `export PATH` line:

```makefile
UNAME_S := $(shell uname -s | tr '[:upper:]' '[:lower:]')
UNAME_M := $(shell uname -m)
ifeq ($(UNAME_M),x86_64)
  ARCH := amd64
else ifeq ($(UNAME_M),aarch64)
  ARCH := arm64
else ifeq ($(UNAME_M),arm64)
  ARCH := arm64
else
  ARCH := $(UNAME_M)
endif
```

**Step 3: Add install targets**

```makefile
$(KIND): | $(TOOLS_BIN)
	curl -fsSL -o $(KIND) https://kind.sigs.k8s.io/dl/v$(KIND_VERSION)/kind-$(UNAME_S)-$(ARCH)
	chmod +x $(KIND)
	@$(KIND) version

$(KUBECTL): | $(TOOLS_BIN)
	curl -fsSL -o $(KUBECTL) https://dl.k8s.io/release/v$(KUBECTL_VERSION)/bin/$(UNAME_S)/$(ARCH)/kubectl
	chmod +x $(KUBECTL)
	@$(KUBECTL) version --client

$(HELM): | $(TOOLS_BIN)
	curl -fsSL https://get.helm.sh/helm-v$(HELM_VERSION)-$(UNAME_S)-$(ARCH).tar.gz | tar xz -C $(TOOLS_BIN) --strip-components=1 $(UNAME_S)-$(ARCH)/helm
	@$(HELM) version

$(ISTIOCTL): | $(TOOLS_BIN)
	curl -fsSL https://github.com/istio/istio/releases/download/$(ISTIO_VERSION)/istioctl-$(ISTIO_VERSION)-$(UNAME_S)-$(ARCH).tar.gz | tar xz -C $(TOOLS_BIN) istioctl
	@$(ISTIOCTL) version --remote=false

$(SKAFFOLD): | $(TOOLS_BIN)
	curl -fsSL -o $(SKAFFOLD) https://storage.googleapis.com/skaffold/releases/v$(SKAFFOLD_VERSION)/skaffold-$(UNAME_S)-$(ARCH)
	chmod +x $(SKAFFOLD)
	@$(SKAFFOLD) version
```

**Step 4: Update `tools` target**

```makefile
tools: $(BUN) $(GOLANGCI) $(KIND) $(KUBECTL) $(HELM) $(ISTIOCTL) $(SKAFFOLD)
```

**Step 5: Add AKS safety guard function**

Add before the install targets:

```makefile
# AKS safety guard — call this at the start of any K8s target
define CHECK_NOT_AKS
	@if $(KUBECTL) get nodes -o name 2>/dev/null | grep -qi aks; then \
		echo "ERROR: AKS cluster detected. K8s dev targets are for Kind only."; \
		exit 1; \
	fi
endef
```

**Step 6: Verify tools install**

```bash
make tools
```
Expected: all tools download and print versions.

**Step 7: Commit**

```bash
git add tools.mk
git commit -m "add K8s tooling to tools.mk

kind, kubectl, helm, istioctl, skaffold installed to ./bin/
with OS/arch detection and AKS safety guard."
```

---

### Task 3: Create Kind cluster config and Makefile targets

**Files:**
- Create: `k8s/kind-config.yaml`
- Modify: `Makefile`

**Step 1: Create Kind config**

Create `k8s/kind-config.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
```

**Step 2: Add cluster targets to Makefile**

Add after the `install` target section:

```makefile
CLUSTER_NAME := loctrec

# K8s cluster
cluster-create: $(KIND) $(KUBECTL)
	$(call CHECK_NOT_AKS)
	@$(KIND) delete cluster --name $(CLUSTER_NAME) 2>/dev/null || true
	$(KIND) create cluster --name $(CLUSTER_NAME) --config k8s/kind-config.yaml
	@$(KUBECTL) cluster-info --context kind-$(CLUSTER_NAME)
```

**Step 3: Verify**

```bash
make cluster-create
```
Expected: Kind cluster created, kubectl shows cluster info.

```bash
make cluster-create
```
Expected: deletes old cluster, creates new one (idempotent).

**Step 4: Commit**

```bash
git add k8s/kind-config.yaml Makefile
git commit -m "add Kind cluster config and create target"
```

---

### Task 4: Create cluster bootstrap scripts

**Files:**
- Create: `k8s/bootstrap/istio.sh`
- Create: `k8s/bootstrap/cert-manager.sh`
- Create: `k8s/bootstrap/postgres-values.yaml`
- Create: `k8s/bootstrap/redis-values.yaml`

**Step 1: Create Istio bootstrap script**

Create `k8s/bootstrap/istio.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ISTIOCTL="${1:?Usage: istio.sh <istioctl-path>}"
KUBECTL="${2:?Usage: istio.sh <istioctl-path> <kubectl-path>}"

echo "Installing Istio..."
"$ISTIOCTL" install --set profile=demo -y

echo "Waiting for Istio pods..."
"$KUBECTL" wait --for=condition=ready pod -l app=istiod -n istio-system --timeout=120s

echo "Enabling sidecar injection in default namespace..."
"$KUBECTL" label namespace default istio-injection=enabled --overwrite

echo "Istio installed."
```

**Step 2: Create cert-manager bootstrap script**

Create `k8s/bootstrap/cert-manager.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

KUBECTL="${1:?Usage: cert-manager.sh <kubectl-path>}"
CERT_MANAGER_VERSION="${2:-v1.17.1}"

echo "Installing cert-manager ${CERT_MANAGER_VERSION}..."
"$KUBECTL" apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

echo "Waiting for cert-manager pods..."
"$KUBECTL" wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s

echo "cert-manager installed."
```

**Step 3: Create Postgres values**

Create `k8s/bootstrap/postgres-values.yaml`:

```yaml
auth:
  username: loctrec
  password: loctrec
  database: loctrec
primary:
  persistence:
    size: 1Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 100m
    limits:
      memory: 512Mi
      cpu: 500m
```

**Step 4: Create Redis values**

Create `k8s/bootstrap/redis-values.yaml`:

```yaml
architecture: standalone
auth:
  enabled: false
master:
  persistence:
    size: 512Mi
  resources:
    requests:
      memory: 64Mi
      cpu: 50m
    limits:
      memory: 128Mi
      cpu: 250m
```

**Step 5: Make scripts executable**

```bash
chmod +x k8s/bootstrap/istio.sh k8s/bootstrap/cert-manager.sh
```

**Step 6: Commit**

```bash
git add k8s/bootstrap/
git commit -m "add cluster bootstrap scripts for Istio, cert-manager, Postgres, Redis"
```

---

### Task 5: Add bootstrap and full cluster-up Makefile targets

**Files:**
- Modify: `Makefile`

**Step 1: Add bootstrap target**

Add after `cluster-create`:

```makefile
cluster-bootstrap: $(KUBECTL) $(HELM) $(ISTIOCTL)
	$(call CHECK_NOT_AKS)
	bash k8s/bootstrap/istio.sh $(ISTIOCTL) $(KUBECTL)
	bash k8s/bootstrap/cert-manager.sh $(KUBECTL)
	$(HELM) repo add bitnami https://charts.bitnami.com/bitnami --force-update
	$(HELM) upgrade --install postgres bitnami/postgresql -f k8s/bootstrap/postgres-values.yaml --wait
	$(HELM) upgrade --install redis bitnami/redis -f k8s/bootstrap/redis-values.yaml --wait

cluster-up: cluster-create cluster-bootstrap
	@echo "Cluster ready."

cluster-down: $(KIND)
	$(KIND) delete cluster --name $(CLUSTER_NAME)
```

**Step 2: Update .PHONY**

Add `cluster-create cluster-bootstrap cluster-up cluster-down` to the `.PHONY` line.

**Step 3: Verify**

```bash
make cluster-up
```
Expected: Kind cluster created, Istio installed, cert-manager installed, Postgres + Redis deployed.

```bash
kubectl get pods
```
Expected: Postgres and Redis pods running.

**Step 4: Commit**

```bash
git add Makefile
git commit -m "add cluster-bootstrap and cluster-up targets"
```

---

### Task 6: Create Helm charts for services

**Files:**
- Create: `charts/auth/Chart.yaml`
- Create: `charts/auth/values.yaml`
- Create: `charts/auth/templates/deployment.yaml`
- Create: `charts/auth/templates/service.yaml`
- Create: `charts/events/Chart.yaml`
- Create: `charts/events/values.yaml`
- Create: `charts/events/templates/deployment.yaml`
- Create: `charts/events/templates/service.yaml`
- Create: `charts/tracker/Chart.yaml`
- Create: `charts/tracker/values.yaml`
- Create: `charts/tracker/templates/deployment.yaml`
- Create: `charts/tracker/templates/service.yaml`

**Step 1: Create auth chart**

`charts/auth/Chart.yaml`:
```yaml
apiVersion: v2
name: auth
description: LocTrec auth service
version: 0.1.0
appVersion: "0.0.1"
```

`charts/auth/values.yaml`:
```yaml
replicaCount: 1

image:
  repository: loctrec-auth
  tag: latest
  pullPolicy: IfNotPresent

service:
  port: 8081

env:
  PORT: "8081"
  DATABASE_URL: "postgres://loctrec:loctrec@postgres-postgresql:5432/loctrec?sslmode=disable"

resources:
  requests:
    memory: 64Mi
    cpu: 50m
  limits:
    memory: 256Mi
    cpu: 500m
```

`charts/auth/templates/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
          env:
            {{- range $key, $value := .Values.env }}
            - name: {{ $key }}
              value: {{ $value | quote }}
            {{- end }}
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

`charts/auth/templates/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
spec:
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.port }}
      protocol: TCP
  selector:
    app: {{ .Chart.Name }}
```

**Step 2: Create events chart**

Same structure as auth. `charts/events/Chart.yaml`:
```yaml
apiVersion: v2
name: events
description: LocTrec events service
version: 0.1.0
appVersion: "0.0.1"
```

`charts/events/values.yaml`:
```yaml
replicaCount: 1

image:
  repository: loctrec-events
  tag: latest
  pullPolicy: IfNotPresent

service:
  port: 8082

env:
  PORT: "8082"
  DATABASE_URL: "postgres://loctrec:loctrec@postgres-postgresql:5432/loctrec?sslmode=disable"

resources:
  requests:
    memory: 64Mi
    cpu: 50m
  limits:
    memory: 256Mi
    cpu: 500m
```

Templates: identical to auth (copy `deployment.yaml` and `service.yaml`).

**Step 3: Create tracker chart**

`charts/tracker/Chart.yaml`:
```yaml
apiVersion: v2
name: tracker
description: LocTrec tracker WebSocket service
version: 0.1.0
appVersion: "0.0.1"
```

`charts/tracker/values.yaml`:
```yaml
replicaCount: 1

image:
  repository: loctrec-tracker
  tag: latest
  pullPolicy: IfNotPresent

service:
  port: 8083

env:
  PORT: "8083"
  AUTH_SERVICE_URL: "http://auth:8081"

resources:
  requests:
    memory: 32Mi
    cpu: 25m
  limits:
    memory: 128Mi
    cpu: 250m
```

Templates: identical to auth (copy `deployment.yaml` and `service.yaml`).

**Step 4: Lint charts**

```bash
make helm-lint
```
(We'll add this target in Task 8 — for now run manually):
```bash
./bin/helm lint charts/auth charts/events charts/tracker
```
Expected: all 3 charts pass lint.

**Step 5: Commit**

```bash
git add charts/
git commit -m "add Helm charts for auth, events, and tracker services"
```

---

### Task 7: Create Istio Gateway and VirtualServices

**Files:**
- Create: `charts/auth/templates/virtualservice.yaml`
- Create: `charts/events/templates/virtualservice.yaml`
- Create: `charts/tracker/templates/virtualservice.yaml`
- Create: `k8s/gateway.yaml`

**Step 1: Create Istio Gateway resource**

Create `k8s/gateway.yaml`:
```yaml
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: loctrec-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "*"
```

**Step 2: Create auth VirtualService**

`charts/auth/templates/virtualservice.yaml`:
```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: {{ .Chart.Name }}
spec:
  hosts:
    - "*"
  gateways:
    - loctrec-gateway
  http:
    - match:
        - uri:
            prefix: /api/auth
      rewrite:
        uri: /
      route:
        - destination:
            host: {{ .Chart.Name }}
            port:
              number: {{ .Values.service.port }}
```

**Step 3: Create events VirtualService**

`charts/events/templates/virtualservice.yaml` — same structure, prefix `/api/events`.

**Step 4: Create tracker VirtualService**

`charts/tracker/templates/virtualservice.yaml` — same structure, prefix `/api/tracker`.

**Step 5: Add gateway apply to bootstrap**

Add to Makefile `cluster-bootstrap` target, after the helm installs:
```makefile
	$(KUBECTL) apply -f k8s/gateway.yaml
```

**Step 6: Commit**

```bash
git add k8s/gateway.yaml charts/
git commit -m "add Istio Gateway and VirtualService routing per service"
```

---

### Task 8: Create Skaffold config

**Files:**
- Create: `skaffold.yaml`
- Modify: `Makefile`

**Step 1: Create skaffold.yaml**

```yaml
apiVersion: skaffold/v4beta12
kind: Config
metadata:
  name: loctrec

build:
  local:
    push: false
  artifacts:
    - image: loctrec-auth
      context: services/auth
      docker:
        dockerfile: Dockerfile
    - image: loctrec-events
      context: services/events
      docker:
        dockerfile: Dockerfile
    - image: loctrec-tracker
      context: services/tracker
      docker:
        dockerfile: Dockerfile

deploy:
  helm:
    releases:
      - name: auth
        chartPath: charts/auth
        setValueTemplates:
          image.repository: "{{.IMAGE_REPO_loctrec_auth}}"
          image.tag: "{{.IMAGE_TAG_loctrec_auth}}@{{.IMAGE_DIGEST_loctrec_auth}}"
      - name: events
        chartPath: charts/events
        setValueTemplates:
          image.repository: "{{.IMAGE_REPO_loctrec_events}}"
          image.tag: "{{.IMAGE_TAG_loctrec_events}}@{{.IMAGE_DIGEST_loctrec_events}}"
      - name: tracker
        chartPath: charts/tracker
        setValueTemplates:
          image.repository: "{{.IMAGE_REPO_loctrec_tracker}}"
          image.tag: "{{.IMAGE_TAG_loctrec_tracker}}@{{.IMAGE_DIGEST_loctrec_tracker}}"
```

**Step 2: Add deploy/dev targets to Makefile**

```makefile
deploy: $(SKAFFOLD) $(KUBECTL)
	$(call CHECK_NOT_AKS)
	$(SKAFFOLD) run

dev: $(SKAFFOLD) $(KUBECTL)
	$(call CHECK_NOT_AKS)
	$(SKAFFOLD) dev

helm-lint: $(HELM)
	$(HELM) lint charts/auth charts/events charts/tracker
```

Add `deploy dev helm-lint` to `.PHONY`.

**Step 3: Verify**

```bash
make helm-lint
```
Expected: all charts pass.

**Step 4: Commit**

```bash
git add skaffold.yaml Makefile
git commit -m "add Skaffold config and deploy/dev Makefile targets"
```

---

### Task 9: Update CLAUDE.md and clean up

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Rewrite CLAUDE.md**

Update the architecture table (remove gateway), update prerequisites (add Kind, kubectl, Helm, etc — note they auto-install via `make tools`), replace docker-compose commands with K8s commands:

```bash
make tools             # Install all dev tools to ./bin/
make cluster-up        # Create Kind cluster + bootstrap (Istio, cert-manager, Postgres, Redis)
make cluster-down      # Delete Kind cluster
make dev               # Skaffold dev loop (build + deploy + watch)
make deploy            # Skaffold run (build + deploy once)
make helm-lint         # Lint all Helm charts
make build             # Build all services
make test              # Test all services
make lint              # Lint all services (includes format check)
make format            # Auto-format all services
```

Add safety note: "All K8s targets include an AKS safety guard — they refuse to run against AKS clusters."

**Step 2: Verify everything**

```bash
make lint
make build
make helm-lint
```
Expected: all pass.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "update CLAUDE.md for Kubernetes workflow"
```

---

### Task 10: Full end-to-end verification

**Step 1: Clean start**

```bash
make cluster-down 2>/dev/null || true
make tools-clean
```

**Step 2: Install tools**

```bash
make tools
```
Expected: all tools install to `./bin/`.

**Step 3: Create cluster**

```bash
make cluster-up
```
Expected: Kind cluster with Istio, cert-manager, Postgres, Redis.

**Step 4: Deploy services**

```bash
make deploy
```
Expected: Skaffold builds images, deploys via Helm, all pods running.

**Step 5: Verify pods**

```bash
kubectl get pods
```
Expected: auth, events, tracker pods all Running/Ready.

**Step 6: Verify routing**

```bash
kubectl port-forward svc/istio-ingressgateway -n istio-system 8080:80 &
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/events/health
curl http://localhost:8080/api/tracker/health
```
Expected: each returns `{"status":"ok","service":"<name>"}`.

**Step 7: Commit final**

```bash
git add -A
git commit -m "end-to-end verified: K8s migration complete"
```
