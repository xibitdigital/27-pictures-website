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
add-image: ## Watermark + hash (keeps src ext; --config appends only) SRC=… TOON=<content/toons folder> [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1]
	@test -n "$(SRC)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1]" && exit 1)
	@test -n "$(TOON)" || (echo "Usage: make add-image SRC=path/to.jpg TOON=jax [UPLOAD=1] [CONFIG=1] [KEEP_LOCAL=1]" && exit 1)
	$(NPM) run add-image -- "$(SRC)" --toon "$(TOON)" \
		$(if $(filter 1 true yes,$(UPLOAD)),--upload,) \
		$(if $(filter 1 true yes,$(CONFIG) $(MANIFEST)),--config,) \
		$(if $(filter 1 true yes,$(KEEP_LOCAL)),--keep-local,) \
		$(ARGS)

.PHONY: convert-plates
convert-plates: ## Toon plates → WebP in converted/ (TOON=jax|erin|nero [QUALITY=90] [UPLOAD=1] [NO_BAND=1] [DRY=1])
	@test -n "$(TOON)" || (echo "Usage: make convert-plates TOON=nero [QUALITY=90] [UPLOAD=1] [NO_BAND=1] [DRY=1]" && exit 1)
	$(NPM) run convert-plates -- --toon "$(TOON)" \
		--quality "$(or $(QUALITY),90)" \
		$(if $(filter 1 true yes,$(UPLOAD)),--upload,) \
		$(if $(filter 1 true yes,$(NO_BAND)),--no-band,) \
		$(if $(filter 1 true yes,$(DRY)),--dry-run,) \
		$(ARGS)

.PHONY: swap-page
swap-page: ## Replace page N or append: watermark → WebP → R2 → config (SRC=… TOON=<folder> [PAGE=N] [PUBLISH=1] [DRY=1]). Cannot insert mid-list.
	@test -n "$(SRC)" || (echo "Usage: make swap-page SRC=path/to.png TOON=nero [PAGE=N] [QUALITY=90] [PUBLISH=1] [DRY=1]" && exit 1)
	@test -n "$(TOON)" || (echo "Usage: make swap-page SRC=path/to.png TOON=nero [PAGE=N] [QUALITY=90] [PUBLISH=1] [DRY=1]" && exit 1)
	$(NPM) run swap-page -- "$(SRC)" --toon "$(TOON)" \
		$(if $(PAGE),--page "$(PAGE)",) \
		--quality "$(or $(QUALITY),90)" \
		$(if $(filter 1 true yes,$(PUBLISH)),--publish,) \
		$(if $(filter 1 true yes,$(DRY)),--dry-run,) \
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

.PHONY: backup-cdn
backup-cdn: ## Download CDN/R2 lock keys into cdn-backup/ (use ARGS=--images-only)
	$(NPM) run backup-cdn -- $(ARGS)

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

PAGES_PROJECT ?= twentyseven-pictures
PAGES_BRANCH  ?= main
# Staging is its own Pages project: a custom domain always serves a project's
# production branch, so staging.twentyseven.pictures cannot point at a preview
# branch of the main project. functions/_middleware.js basic-auths every host
# that is not twentyseven.pictures.
STAGING_PROJECT ?= twentyseven-pictures-staging
PREVIEW_BRANCH ?= staging

.PHONY: ship
ship: require-cdn-base ## Upload + verify + publish + deploy one toon (TOON=erin-the-revenge [PROD=1] [DRY=1])
	@test -n "$(TOON)" || (echo "Usage: make ship TOON=erin-the-revenge [PROD=1] [DRY=1]" && exit 1)
	$(NPM) run ship-toon -- --toon "$(TOON)" \
		$(if $(filter 1 true yes,$(PROD)),--production,) \
		$(if $(filter 1 true yes,$(DRY)),--dry-run,) \
		$(ARGS)

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
# Staging ships uncommitted work, so the bare git SHA stamps every deploy of a
# working session identically — and the build id on the cover is the only way to
# tell from a phone whether it is looking at a stale cache. Append a timestamp
# whenever the tree is dirty.
	VITE_FLIPFRAME_BUILD="$$(git rev-parse --short HEAD)$$(git diff --quiet || printf '+%s' "$$(date +%m%d-%H%M)")" $(NPM) run build
	@find dist -name .DS_Store -delete 2>/dev/null || true
	@echo "→ Deploying dist/ → $(STAGING_PROJECT) ($(PREVIEW_BRANCH))"
	$(NPX) wrangler pages deploy dist \
		--project-name=$(STAGING_PROJECT) \
		--branch=$(PREVIEW_BRANCH) \
		--commit-dirty=true \
		--commit-message="preview: vue frontend MPA"
	@echo "✓ Staging: https://staging.twentyseven.pictures (admin / see Pages secrets)"

.PHONY: preview-cdn
preview-cdn: preview-deploy ## Alias for preview-deploy (CDN required)

.PHONY: serve
serve: dev ## Alias for dev

.PHONY: all
all: hash-assets test build ## Hash CSS, test, and build
