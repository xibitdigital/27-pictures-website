# 27 Pictures website — Makefile wrappers around package.json scripts.
# Prefer: make <target>
#
# CDN production: set VITE_ASSET_BASE in .env (Vite loads it automatically).
#   VITE_ASSET_BASE=https://pub-….r2.dev   # or assets.twentyseven.pictures

NPM ?= npm
NPX ?= npx

# Load .env for Make recipes (VITE_ASSET_BASE, PREVIEW_*, R2_BUCKET)
ifneq (,$(wildcard .env))
  include .env
  export
endif

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z0-9_.-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Dependencies / local tooling
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install npm deps + pre-commit / pre-push hooks
	$(NPM) install
	@command -v pre-commit >/dev/null 2>&1 || brew install pre-commit
	pre-commit install --hook-type pre-commit --hook-type pre-push

.PHONY: check
check: ## Tests + production build (same as pre-push gate)
	$(NPM) run check

.PHONY: format
format: ## Format src/ + public/ with Prettier
	$(NPM) run format

.PHONY: format-check
format-check: ## Fail if Prettier would change files
	$(NPM) run format:check

.PHONY: local-ci
local-ci: ## Run pre-commit on all files
	pre-commit run --all-files

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

.PHONY: dev
dev: ## Vite dev server (127.0.0.1 — same-origin media from public/)
	$(NPM) run dev

.PHONY: build
build: ## Typecheck + production build → dist/
	$(NPM) run build

.PHONY: preview
preview: ## Vite preview of dist/ (127.0.0.1)
	$(NPM) run preview

.PHONY: local
local: ## Serve dist/ on 127.0.0.1 with HTTP Basic Auth
	@test -d dist || $(NPM) run build
	$(NPM) run local

.PHONY: require-cdn-base
require-cdn-base:
	@test -n "$(VITE_ASSET_BASE)" || ( \
		echo "Set VITE_ASSET_BASE in .env (CDN origin for media), e.g.:" && \
		echo "  VITE_ASSET_BASE=https://pub-….r2.dev" && \
		echo "  VITE_ASSET_BASE=https://assets.twentyseven.pictures" && \
		exit 1)

.PHONY: local-cdn
local-cdn: require-cdn-base ## Build with CDN media + serve protected on 127.0.0.1
	@echo "→ Building with VITE_ASSET_BASE=$(VITE_ASSET_BASE)"
	$(NPM) run build
	@echo "→ Serving protected local preview"
	$(NPM) run local

.PHONY: typecheck
typecheck: ## vue-tsc only
	$(NPM) run typecheck

.PHONY: test
test: ## Run unit tests once
	$(NPM) run test

.PHONY: test-watch
test-watch: ## Vitest watch mode
	$(NPM) run test:watch

.PHONY: hash-assets
hash-assets: ## Bump ?v=<content-hash> for public CSS
	$(NPM) run hash-assets

.PHONY: hash-assets-check
hash-assets-check: ## Fail if HTML asset versions are stale
	$(NPM) run hash-assets:check

.PHONY: generate-qr
generate-qr: ## Branded QR PDF → ~/Downloads/
	$(NPM) run generate-qr

.PHONY: generate-qr-image
generate-qr-image: ## QR image helper
	$(NPM) run generate-qr-image

.PHONY: watermark
watermark: ## Bake site watermark (pass ARGS=…)
	$(NPM) run watermark -- $(ARGS)

.PHONY: add-image
add-image: ## Watermark + hash toon image → R2 (SRC=… TOON=jax|erin [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1])
	@test -n "$(SRC)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1]" && exit 1)
	@test -n "$(TOON)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1]" && exit 1)
	$(NPM) run add-image -- "$(SRC)" --toon "$(TOON)" \
		$(if $(filter 1 true yes,$(UPLOAD)),--upload,) \
		$(if $(filter 1 true yes,$(CONFIG) $(MANIFEST)),--config,) \
		$(if $(filter 1 true yes,$(KEEP_LOCAL)),--keep-local,) \
		$(ARGS)

.PHONY: create-assets-bucket
create-assets-bucket: ## Create Cloudflare R2 bucket
	$(NPM) run create-assets-bucket

.PHONY: upload-assets
upload-assets: ## Sync public/toons + card-art → R2
	$(NPM) run upload-assets -- $(ARGS)

.PHONY: upload-assets-dry
upload-assets-dry: ## Dry-run R2 media sync
	$(NPM) run upload-assets:dry

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

PAGES_PROJECT ?= twentyseven-pictures
PAGES_BRANCH  ?= main
PREVIEW_BRANCH ?= staging

.PHONY: deploy
deploy: require-cdn-base ## Build (requires VITE_ASSET_BASE) + deploy Pages production
	@echo "→ CDN media: $(VITE_ASSET_BASE)"
	$(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	@echo "→ Deploying dist/ → $(PAGES_PROJECT) ($(PAGES_BRANCH))"
	$(NPX) wrangler pages deploy dist \
		--project-name=$(PAGES_PROJECT) \
		--branch=$(PAGES_BRANCH) \
		--commit-dirty=true
	@echo "✓ Live: https://twentyseven.pictures"

.PHONY: deploy-cdn
deploy-cdn: require-cdn-base upload-assets ## Upload R2 + build with CDN + deploy production
	@$(MAKE) deploy

.PHONY: preview-deploy
preview-deploy: require-cdn-base ## Build + deploy Pages preview branch
	@echo "→ CDN media: $(VITE_ASSET_BASE)"
	$(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	$(NPX) wrangler pages deploy dist \
		--project-name=$(PAGES_PROJECT) \
		--branch=$(PREVIEW_BRANCH) \
		--commit-dirty=true \
		--commit-message="preview: vue frontend MPA"

.PHONY: preview-cdn
preview-cdn: preview-deploy ## Alias for preview-deploy (CDN required)

.PHONY: serve
serve: dev ## Alias for dev

.PHONY: all
all: hash-assets test build ## Hash CSS, test, and build
