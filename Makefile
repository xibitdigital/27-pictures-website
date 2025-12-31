PRECOMMIT_UTILS=pre-commit

.PHONY: install
install: ## Install dependencies for pre-commit
	brew install ${PRECOMMIT_UTILS}
	pre-commit install

.PHONY: local-ci
local-ci:
	pre-commit run --all-files
