# 27 Pictures website — Makefile wrappers around package.json scripts.
# Prefer: make <target>   (same as npm run <target>)

NPM ?= npm
NPX ?= npx

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
format: ## Format src/ + public/ with Prettier (also runs on pre-commit)
	$(NPM) run format

.PHONY: format-check
format-check: ## Fail if Prettier would change files
	$(NPM) run format:check

.PHONY: local-ci
local-ci: ## Run pre-commit on all files
	pre-commit run --all-files

# ---------------------------------------------------------------------------
# App (mirrors package.json "scripts")
# ---------------------------------------------------------------------------

.PHONY: dev
dev: ## Vite dev server (Vue MPA)
	$(NPM) run dev

.PHONY: dev-protected
dev-protected: ## Vite on 127.0.0.1 + HTTP Basic Auth (PREVIEW_USER/PASS)
	@echo "→ Protected dev (loopback + basic auth)"
	@echo "  user=$${PREVIEW_USER:-dev}  pass=$${PREVIEW_PASS:-dev}"
	PROTECTED=1 LOCAL_ONLY=1 $(NPM) run dev

.PHONY: build
build: ## Typecheck + production build → dist/
	$(NPM) run build

.PHONY: preview
preview: ## Preview production build
	$(NPM) run preview

# Production-like local server: loopback + basic auth (serves dist/)
.PHONY: local
local: ## Serve dist/ on 127.0.0.1 with basic auth (build first if needed)
	@test -d dist || $(NPM) run build
	$(NPM) run local

# Same, but build against R2 so media loads from the bucket
.PHONY: local-cdn
local-cdn: ## Build with R2 assets + serve dist/ protected on 127.0.0.1
	@echo "→ Building with VITE_ASSET_BASE=$(R2_PUBLIC_BASE)"
	VITE_ASSET_BASE="$(R2_PUBLIC_BASE)" $(NPM) run build
	@echo "→ Serving protected local preview (media from R2)"
	$(NPM) run local

.PHONY: typecheck
typecheck: ## vue-tsc only
	$(NPM) run typecheck

.PHONY: test
test: ## Run unit tests once
	$(NPM) run test

.PHONY: test-watch
test-watch: ## Vitest watch mode (npm run test:watch)
	$(NPM) run test:watch

.PHONY: hash-assets
hash-assets: ## Bump ?v=<content-hash> for public CSS in all HTML
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
watermark: ## Bake site watermark into images (pass args after --)
	$(NPM) run watermark -- $(ARGS)

# Add a new toon page: watermark → content-hash → public/toons/<toon>/assets/
#   make add-image SRC=~/Downloads/page.jpg TOON=jax
#   make add-image SRC=./page.jpg TOON=erin UPLOAD=1 MANIFEST=1
.PHONY: add-image
add-image: ## Watermark + hash + place a toon image (SRC=… TOON=jax|erin [UPLOAD=1] [MANIFEST=1])
	@test -n "$(SRC)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [MANIFEST=1]" && exit 1)
	@test -n "$(TOON)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [MANIFEST=1]" && exit 1)
	$(NPM) run add-image -- "$(SRC)" --toon "$(TOON)" \
		$(if $(filter 1 true yes,$(UPLOAD)),--upload,) \
		$(if $(filter 1 true yes,$(MANIFEST)),--manifest,) \
		$(ARGS)

.PHONY: create-assets-bucket
create-assets-bucket: ## Create Cloudflare R2 bucket for toon media
	$(NPM) run create-assets-bucket

.PHONY: upload-assets
upload-assets: ## Sync public/toons media → R2 (pass ARGS='--dry-run' etc.)
	$(NPM) run upload-assets -- $(ARGS)

.PHONY: upload-assets-dry
upload-assets-dry: ## Dry-run R2 media sync
	$(NPM) run upload-assets:dry

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

PAGES_PROJECT ?= twentyseven-pictures
PAGES_BRANCH  ?= main

.PHONY: deploy
deploy: ## Build and deploy to Cloudflare Pages (production)
	@echo "→ Building…"
	$(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	@echo "→ Deploying dist/ → $(PAGES_PROJECT) ($(PAGES_BRANCH))"
	$(NPX) wrangler pages deploy dist \
		--project-name=$(PAGES_PROJECT) \
		--branch=$(PAGES_BRANCH) \
		--commit-dirty=true
	@echo "✓ Live: https://twentyseven.pictures"

.PHONY: deploy-media
deploy-media: ## Upload toon media to R2, then build + deploy Pages
	@echo "→ Syncing media to R2…"
	$(NPM) run upload-assets
	@$(MAKE) deploy

# R2 public base for CDN preview builds (override: make preview-cdn VITE_ASSET_BASE=…)
R2_PUBLIC_BASE ?= https://pub-e60c8fa8eea343fbac708bf75981d19c.r2.dev
PREVIEW_BRANCH ?= feat/vue-frontend

.PHONY: preview-deploy
preview-deploy: ## Build and deploy a Pages preview branch (same-origin assets)
	@echo "→ Building…"
	$(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	@echo "→ Deploying dist/ → $(PAGES_PROJECT) ($(PREVIEW_BRANCH))"
	$(NPX) wrangler pages deploy dist \
		--project-name=$(PAGES_PROJECT) \
		--branch=$(PREVIEW_BRANCH) \
		--commit-dirty=true \
		--commit-message="preview: vue frontend MPA"

.PHONY: preview-cdn
preview-cdn: ## Build with R2 media base + deploy Pages preview
	@echo "→ Building with VITE_ASSET_BASE=$(R2_PUBLIC_BASE)"
	VITE_ASSET_BASE="$(R2_PUBLIC_BASE)" $(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	@echo "→ Deploying dist/ → $(PAGES_PROJECT) ($(PREVIEW_BRANCH)) [CDN assets]"
	$(NPX) wrangler pages deploy dist \
		--project-name=$(PAGES_PROJECT) \
		--branch=$(PREVIEW_BRANCH) \
		--commit-dirty=true \
		--commit-message="preview: CDN assets from R2"
	@echo "✓ Media base: $(R2_PUBLIC_BASE)"

.PHONY: serve
serve: dev ## Alias for dev (legacy name)

.PHONY: all
all: hash-assets test build ## Hash CSS, test, and build
