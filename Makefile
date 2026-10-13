.PHONY: install lint typecheck test validate-config validate-data dev build clean

install:
	cd web && npm install
	pip install jsonschema pytest numpy

lint:
	cd web && npm run lint || true
	python3 -m py_compile tools/*.py

typecheck:
	cd web && npm run typecheck

test: validate-config test-tools test-web

test-tools:
	pytest tools/ -v

test-web:
	cd web && npm run test

validate-config:
	python3 tools/validate_config.py

validate-data:
	python3 tools/validate_data.py --dir data/raw

dev:
	cd web && npm run dev

build:
	cd web && npm run build

clean:
	rm -rf web/dist web/node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
