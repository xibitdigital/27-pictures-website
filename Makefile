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

# ---------------------------------------------------------------------------
# Deploy helpers (not in package.json; thin wrappers)
# ---------------------------------------------------------------------------

.PHONY: deploy
deploy: build ## Production: hash CSS (via build), build, deploy dist/ to main
	@find dist -name .DS_Store -delete 2>/dev/null || true
	$(NPX) wrangler pages deploy dist \
		--project-name=twentyseven-pictures \
		--branch=main \
		--commit-dirty=true

.PHONY: preview-deploy
preview-deploy: build ## Preview only: hash CSS (via build), deploy to feat/vue-frontend
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
