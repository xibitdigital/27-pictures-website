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
install: ## Install npm deps + pre-commit hooks
	$(NPM) install
	@command -v pre-commit >/dev/null 2>&1 || brew install pre-commit
	pre-commit install

.PHONY: local-ci
local-ci: ## Run pre-commit on all files
	pre-commit run --all-files

# ---------------------------------------------------------------------------
# App (mirrors package.json "scripts")
# ---------------------------------------------------------------------------

.PHONY: dev
dev: ## Vite dev server (Vue MPA)
	$(NPM) run dev

.PHONY: build
build: ## Typecheck + production build → dist/
	$(NPM) run build

.PHONY: preview
preview: ## Preview production build
	$(NPM) run preview

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
hash-assets: ## Content-hash CSS ?v= query strings in HTML
	$(NPM) run hash-assets

.PHONY: generate-qr
generate-qr: ## Branded QR PDF → ~/Downloads/
	$(NPM) run generate-qr

.PHONY: generate-qr-image
generate-qr-image: ## QR image helper
	$(NPM) run generate-qr-image

.PHONY: watermark
watermark: ## Bake site watermark into images (pass args after --)
	$(NPM) run watermark -- $(ARGS)

# ---------------------------------------------------------------------------
# Deploy helpers (not in package.json; thin wrappers)
# ---------------------------------------------------------------------------

.PHONY: deploy
deploy: build ## ⚠ Production: build then deploy dist/ to Cloudflare Pages (custom domain)
	$(NPX) wrangler pages deploy dist --project-name=twentyseven-pictures --commit-dirty=true

.PHONY: preview-deploy
preview-deploy: build ## Preview only: deploy dist/ to branch feat/vue-frontend (not production)
	@find dist -name .DS_Store -delete 2>/dev/null || true
	$(NPX) wrangler pages deploy dist \
		--project-name=twentyseven-pictures \
		--branch=feat/vue-frontend \
		--commit-dirty=true \
		--commit-message="preview: vue frontend MPA"

.PHONY: serve
serve: dev ## Alias for dev (legacy name)

.PHONY: all
all: hash-assets test build ## Hash CSS, test, and build
