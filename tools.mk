## tools.mk — local tool installation into ./bin
## Include this from the main Makefile: include tools.mk

TOOLS_BIN := $(CURDIR)/bin
export PATH := $(TOOLS_BIN):$(PATH)

# Tool versions
BUN_VERSION       := 1.3.9
GOLANGCI_VERSION  := 1.64.5

# Tool binaries
BUN       := $(TOOLS_BIN)/bun
GOLANGCI  := $(TOOLS_BIN)/golangci-lint

.PHONY: tools tools-clean

tools: $(BUN) $(GOLANGCI)

$(TOOLS_BIN):
	mkdir -p $(TOOLS_BIN)

$(BUN): | $(TOOLS_BIN)
	curl -fsSL https://bun.sh/install | BUN_INSTALL=$(CURDIR) bash
	@rm -f $(CURDIR)/_bun
	@$(BUN) --version

$(GOLANGCI): | $(TOOLS_BIN)
	GOBIN=$(TOOLS_BIN) go install github.com/golangci/golangci-lint/cmd/golangci-lint@v$(GOLANGCI_VERSION)
	@$(GOLANGCI) --version

tools-clean:
	rm -rf $(TOOLS_BIN)
