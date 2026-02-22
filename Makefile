include tools.mk

TS_SERVICES := services/auth services/events packages/client-sdk
CLUSTER_NAME := loctrec

.PHONY: build build-auth build-events build-tracker build-sdk \
       test test-auth test-events test-tracker test-sdk \
       lint lint-auth lint-events lint-tracker lint-sdk \
       format format-auth format-events format-tracker format-sdk \
       docker-build docker-build-auth docker-build-events docker-build-tracker \
       clean install \
       cluster-create cluster-bootstrap cluster-up cluster-down \
       deploy dev helm-lint

# Install dependencies
install: $(BUN)
	@for svc in $(TS_SERVICES); do \
		echo "Installing deps in $$svc..."; \
		cd $(CURDIR)/$$svc && $(BUN) install; \
	done

# Build
build: build-auth build-events build-tracker build-sdk

build-auth: $(BUN)
	cd services/auth && $(BUN) build src/index.ts --outdir dist --target bun

build-events: $(BUN)
	cd services/events && $(BUN) build src/index.ts --outdir dist --target bun

build-tracker:
	cd services/tracker && go build -o bin/tracker ./cmd/tracker

build-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) build src/index.ts --outdir dist --target node

# Test
test: test-auth test-events test-tracker test-sdk

test-auth: $(BUN)
	cd services/auth && $(BUN) test

test-events: $(BUN)
	cd services/events && $(BUN) test

test-tracker:
	cd services/tracker && go test ./...

test-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) test

# Lint
lint: lint-auth lint-events lint-tracker lint-sdk

lint-auth: $(BUN)
	cd services/auth && $(BUN) x @biomejs/biome check .

lint-events: $(BUN)
	cd services/events && $(BUN) x @biomejs/biome check .

lint-tracker: $(GOLANGCI)
	cd services/tracker && $(GOLANGCI) run ./...

lint-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) x @biomejs/biome check .

# Format
format: format-auth format-events format-tracker format-sdk

format-auth: $(BUN)
	cd services/auth && $(BUN) x @biomejs/biome format --write .

format-events: $(BUN)
	cd services/events && $(BUN) x @biomejs/biome format --write .

format-tracker:
	cd services/tracker && gofmt -w .

format-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) x @biomejs/biome format --write .

# Docker
docker-build: docker-build-auth docker-build-events docker-build-tracker

docker-build-auth:
	docker build -t loctrec-auth services/auth

docker-build-events:
	docker build -t loctrec-events services/events

docker-build-tracker:
	docker build -t loctrec-tracker services/tracker

# K8s cluster
cluster-create: $(KIND) $(KUBECTL)
	@$(KIND) delete cluster --name $(CLUSTER_NAME) 2>/dev/null || true
	$(KIND) create cluster --name $(CLUSTER_NAME) --config k8s/kind-config.yaml
	@$(KUBECTL) cluster-info --context kind-$(CLUSTER_NAME)

cluster-bootstrap: $(KUBECTL) $(HELM) $(ISTIOCTL)
	$(call CHECK_NOT_AKS)
	@echo "Adding Helm repos..."
	@$(HELM) repo add istio https://istio-release.storage.googleapis.com/charts --force-update
	@$(HELM) repo add jetstack https://charts.jetstack.io --force-update
	@$(HELM) repo add bitnami https://charts.bitnami.com/bitnami --force-update
	@$(HELM) repo update
	@echo "Installing Istio base..."
	$(HELM) upgrade --install istio-base istio/base -n istio-system --create-namespace --version $(ISTIO_VERSION) --wait
	@echo "Installing Istiod..."
	$(HELM) upgrade --install istiod istio/istiod -n istio-system --version $(ISTIO_VERSION) --wait
	@echo "Installing Istio ingress gateway..."
	$(HELM) upgrade --install istio-ingressgateway istio/gateway -n istio-system --version $(ISTIO_VERSION) --wait
	@echo "Enabling sidecar injection..."
	@$(KUBECTL) label namespace default istio-injection=enabled --overwrite
	@echo "Installing cert-manager..."
	$(HELM) upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --version $(CERT_MANAGER_VERSION) --set crds.enabled=true --wait
	@echo "Installing PostgreSQL..."
	$(HELM) upgrade --install postgres bitnami/postgresql -f k8s/bootstrap/postgres-values.yaml --wait
	@echo "Installing Redis..."
	$(HELM) upgrade --install redis bitnami/redis -f k8s/bootstrap/redis-values.yaml --wait
	@echo "Applying Istio Gateway..."
	$(KUBECTL) apply -f k8s/gateway.yaml
	@echo "Cluster bootstrap complete."

cluster-up: cluster-create cluster-bootstrap
	@echo "Cluster ready."

cluster-down: $(KIND)
	$(KIND) delete cluster --name $(CLUSTER_NAME)

# Deploy
deploy: $(SKAFFOLD) $(KUBECTL)
	$(call CHECK_NOT_AKS)
	$(SKAFFOLD) run

dev: $(SKAFFOLD) $(KUBECTL)
	$(call CHECK_NOT_AKS)
	$(SKAFFOLD) dev

helm-lint: $(HELM)
	$(HELM) lint charts/auth charts/events charts/tracker

# Clean
clean:
	rm -rf services/auth/dist
	rm -rf services/events/dist
	rm -rf services/tracker/bin
	rm -rf packages/client-sdk/dist
