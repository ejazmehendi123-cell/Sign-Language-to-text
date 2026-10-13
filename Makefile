.PHONY: install lint typecheck test validate-config validate-data dev build clean

install:
	cd web && npm install
	pip install jsonschema pytest numpy

lint:
	cd web && npm run lint || true
	python3 -m py_compile tools/*.py

typecheck:
	cd web && npm run typecheck

test: validate-config test-tools test-ml test-web

test-tools:
	PYTHONPATH=. pytest tools/ -v

test-ml:
	PYTHONPATH=. pytest tests/ -v

test-web:
	cd web && npm run test

validate-config:
	python3 tools/validate_config.py

validate-data:
	python3 tools/validate_data.py --dir data/raw

train:
	PYTHONPATH=. python3 ml/train.py

evaluate:
	PYTHONPATH=. python3 ml/evaluate.py

benchmark:
	PYTHONPATH=. python3 tools/benchmark_targets.py

dev:
	cd web && npm run dev

build:
	cd web && npm run build

clean:
	rm -rf web/dist web/node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
