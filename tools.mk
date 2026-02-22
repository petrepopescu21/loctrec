## tools.mk — local tool installation into ./bin
## Include this from the main Makefile: include tools.mk

TOOLS_BIN := $(CURDIR)/bin
export PATH := $(TOOLS_BIN):$(PATH)

# OS/arch detection
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

# Tool versions
BUN_VERSION       := 1.3.9
GOLANGCI_VERSION  := 1.64.5
KIND_VERSION      := 0.27.0
KUBECTL_VERSION   := 1.32.3
HELM_VERSION      := 3.17.1
ISTIO_VERSION     := 1.24.3

# OS name mapping (istioctl uses 'osx' instead of 'darwin')
ifeq ($(UNAME_S),darwin)
  ISTIO_OS := osx
else
  ISTIO_OS := $(UNAME_S)
endif
SKAFFOLD_VERSION  := 2.14.0

# Infrastructure chart versions
CERT_MANAGER_VERSION := v1.17.1

# Tool binaries
BUN       := $(TOOLS_BIN)/bun
GOLANGCI  := $(TOOLS_BIN)/golangci-lint
KIND      := $(TOOLS_BIN)/kind
KUBECTL   := $(TOOLS_BIN)/kubectl
HELM      := $(TOOLS_BIN)/helm
ISTIOCTL  := $(TOOLS_BIN)/istioctl
SKAFFOLD  := $(TOOLS_BIN)/skaffold

# AKS safety guard — call at the start of any K8s target
define CHECK_NOT_AKS
	@if $(KUBECTL) get nodes -o name 2>/dev/null | grep -qi aks; then \
		echo "ERROR: AKS cluster detected. K8s dev targets are for Kind only."; \
		exit 1; \
	fi
endef

.PHONY: tools tools-clean

tools: $(BUN) $(GOLANGCI) $(KIND) $(KUBECTL) $(HELM) $(ISTIOCTL) $(SKAFFOLD)

$(TOOLS_BIN):
	mkdir -p $(TOOLS_BIN)

$(BUN): | $(TOOLS_BIN)
	curl -fsSL https://bun.sh/install | BUN_INSTALL=$(CURDIR) bash
	@rm -f $(CURDIR)/_bun
	@$(BUN) --version

$(GOLANGCI): | $(TOOLS_BIN)
	GOBIN=$(TOOLS_BIN) go install github.com/golangci/golangci-lint/cmd/golangci-lint@v$(GOLANGCI_VERSION)
	@$(GOLANGCI) --version

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
	curl -fsSL https://github.com/istio/istio/releases/download/$(ISTIO_VERSION)/istioctl-$(ISTIO_VERSION)-$(ISTIO_OS)-$(ARCH).tar.gz | tar xz -C $(TOOLS_BIN) istioctl
	@$(ISTIOCTL) version --remote=false

$(SKAFFOLD): | $(TOOLS_BIN)
	curl -fsSL -o $(SKAFFOLD) https://storage.googleapis.com/skaffold/releases/v$(SKAFFOLD_VERSION)/skaffold-$(UNAME_S)-$(ARCH)
	chmod +x $(SKAFFOLD)
	@$(SKAFFOLD) version

tools-clean:
	rm -rf $(TOOLS_BIN)
