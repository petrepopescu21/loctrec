include tools.mk

TS_SERVICES := services/gateway services/auth services/events packages/client-sdk

.PHONY: build build-gateway build-auth build-events build-tracker build-sdk \
       test test-gateway test-auth test-events test-tracker test-sdk \
       lint lint-gateway lint-auth lint-events lint-tracker lint-sdk \
       format format-gateway format-auth format-events format-tracker format-sdk \
       docker-build docker-build-gateway docker-build-auth docker-build-events docker-build-tracker \
       docker-up docker-down clean install

# Install dependencies
install: $(BUN)
	@for svc in $(TS_SERVICES); do \
		echo "Installing deps in $$svc..."; \
		cd $(CURDIR)/$$svc && $(BUN) install; \
	done

# Build
build: build-gateway build-auth build-events build-tracker build-sdk

build-gateway: $(BUN)
	cd services/gateway && $(BUN) build src/index.ts --outdir dist --target bun

build-auth: $(BUN)
	cd services/auth && $(BUN) build src/index.ts --outdir dist --target bun

build-events: $(BUN)
	cd services/events && $(BUN) build src/index.ts --outdir dist --target bun

build-tracker:
	cd services/tracker && go build -o bin/tracker ./cmd/tracker

build-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) build src/index.ts --outdir dist --target node

# Test
test: test-gateway test-auth test-events test-tracker test-sdk

test-gateway: $(BUN)
	cd services/gateway && $(BUN) test

test-auth: $(BUN)
	cd services/auth && $(BUN) test

test-events: $(BUN)
	cd services/events && $(BUN) test

test-tracker:
	cd services/tracker && go test ./...

test-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) test

# Lint
lint: lint-gateway lint-auth lint-events lint-tracker lint-sdk

lint-gateway: $(BUN)
	cd services/gateway && $(BUN) x @biomejs/biome check .

lint-auth: $(BUN)
	cd services/auth && $(BUN) x @biomejs/biome check .

lint-events: $(BUN)
	cd services/events && $(BUN) x @biomejs/biome check .

lint-tracker: $(GOLANGCI)
	cd services/tracker && $(GOLANGCI) run ./...

lint-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) x @biomejs/biome check .

# Format
format: format-gateway format-auth format-events format-tracker format-sdk

format-gateway: $(BUN)
	cd services/gateway && $(BUN) x @biomejs/biome format --write .

format-auth: $(BUN)
	cd services/auth && $(BUN) x @biomejs/biome format --write .

format-events: $(BUN)
	cd services/events && $(BUN) x @biomejs/biome format --write .

format-tracker:
	cd services/tracker && gofmt -w .

format-sdk: $(BUN)
	cd packages/client-sdk && $(BUN) x @biomejs/biome format --write .

# Docker
docker-build: docker-build-gateway docker-build-auth docker-build-events docker-build-tracker

docker-build-gateway:
	docker build -t loctrec-gateway services/gateway

docker-build-auth:
	docker build -t loctrec-auth services/auth

docker-build-events:
	docker build -t loctrec-events services/events

docker-build-tracker:
	docker build -t loctrec-tracker services/tracker

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# Clean
clean:
	rm -rf services/gateway/dist
	rm -rf services/auth/dist
	rm -rf services/events/dist
	rm -rf services/tracker/bin
	rm -rf packages/client-sdk/dist
