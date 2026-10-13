#!/usr/bin/env python3
"""
ISL Kiosk Configuration Validator
Validates JSON configuration files against their JSON Schemas and checks semantic cross-references.
"""

import json
import os
import sys
from pathlib import Path
import jsonschema


def load_json(filepath: Path):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[-] ERROR reading JSON file {filepath}: {e}", file=sys.stderr)
        sys.exit(1)


def validate_schema(instance: dict, schema: dict, file_label: str) -> bool:
    try:
        jsonschema.validate(instance=instance, schema=schema)
        print(f"[+] Schema valid: {file_label}")
        return True
    except jsonschema.exceptions.ValidationError as e:
        print(f"[-] Schema validation FAILED for {file_label}:", file=sys.stderr)
        print(f"    Path: {list(e.path)}", file=sys.stderr)
        print(f"    Message: {e.message}", file=sys.stderr)
        return False


def main():
    repo_root = Path(__file__).resolve().parent.parent
    config_dir = repo_root / "config"
    flows_dir = config_dir / "flows"

    has_error = False

    # 1. Validate Vocabulary
    vocab_schema_file = config_dir / "vocabulary.schema.json"
    vocab_file = config_dir / "vocabulary.json"
    vocab_schema = load_json(vocab_schema_file)
    vocab_data = load_json(vocab_file)

    if not validate_schema(vocab_data, vocab_schema, "vocabulary.json"):
        has_error = True

    vocab_ids = set()
    for entry in vocab_data.get("vocabulary", []):
        vid = entry.get("id")
        if vid in vocab_ids:
            print(f"[-] Duplicate vocabulary ID found: {vid}", file=sys.stderr)
            has_error = True
        vocab_ids.add(vid)

    # 2. Validate Thresholds
    thresh_schema_file = config_dir / "thresholds.schema.json"
    thresh_file = config_dir / "thresholds.json"
    thresh_schema = load_json(thresh_schema_file)
    thresh_data = load_json(thresh_file)

    if not validate_schema(thresh_data, thresh_schema, "thresholds.json"):
        has_error = True

    # 3. Validate Feature Flags
    feat_schema_file = config_dir / "features.schema.json"
    feat_file = config_dir / "features.json"
    if feat_schema_file.exists() and feat_file.exists():
        feat_schema = load_json(feat_schema_file)
        feat_data = load_json(feat_file)
        if not validate_schema(feat_data, feat_schema, "features.json"):
            has_error = True

    # 4. Validate Service Flows
    flow_schema_file = config_dir / "flow.schema.json"
    flow_schema = load_json(flow_schema_file)

    flow_files = list(flows_dir.glob("*.json"))
    if not flow_files:
        print("[-] Warning: No flow files found in config/flows/", file=sys.stderr)
        has_error = True

    for flow_path in flow_files:
        flow_data = load_json(flow_path)
        if not validate_schema(flow_data, flow_schema, f"flows/{flow_path.name}"):
            has_error = True
            continue

        states = flow_data.get("states", {})
        initial_state = flow_data.get("initial_state")

        if initial_state not in states:
            print(
                f"[-] Semantic error in {flow_path.name}: initial_state '{initial_state}' not defined in states",
                file=sys.stderr,
            )
            has_error = True

        for state_id, state_def in states.items():
            # Check active vocabulary references
            for vocab_ref in state_def.get("active_vocab", []):
                if vocab_ref not in vocab_ids:
                    print(
                        f"[-] Semantic error in {flow_path.name} (state '{state_id}'): active_vocab '{vocab_ref}' does not exist in vocabulary.json",
                        file=sys.stderr,
                    )
                    has_error = True

            # Check transitions
            for trigger_sign, next_state in state_def.get("transitions", {}).items():
                if trigger_sign not in vocab_ids:
                    print(
                        f"[-] Semantic error in {flow_path.name} (state '{state_id}'): transition trigger '{trigger_sign}' not in vocabulary.json",
                        file=sys.stderr,
                    )
                    has_error = True
                if next_state not in states:
                    print(
                        f"[-] Semantic error in {flow_path.name} (state '{state_id}'): target state '{next_state}' does not exist in states",
                        file=sys.stderr,
                    )
                    has_error = True

            # Check timeout target
            timeout_target = state_def.get("on_timeout")
            if timeout_target and timeout_target not in states:
                print(
                    f"[-] Semantic error in {flow_path.name} (state '{state_id}'): timeout target '{timeout_target}' not in states",
                    file=sys.stderr,
                )
                has_error = True

    # 5. Validate i18n JSON files
    i18n_dir = config_dir / "i18n"
    for lang_code in ["en", "hi", "mr"]:
        lang_file = i18n_dir / f"{lang_code}.json"
        if not lang_file.exists():
            print(f"[-] Missing required i18n file: {lang_file.name}", file=sys.stderr)
            has_error = True
        else:
            try:
                data = load_json(lang_file)
                assert "kiosk" in data and "clerk" in data and "recorder" in data
                print(f"[+] i18n valid: {lang_file.name}")
            except Exception as e:
                print(f"[-] i18n file invalid {lang_file.name}: {e}", file=sys.stderr)
                has_error = True

    if has_error:
        print("\n❌ Configuration validation FAILED.", file=sys.stderr)
        sys.exit(1)
    else:
        print("\n✅ All configurations and schemas validated successfully!")
        sys.exit(0)


if __name__ == "__main__":
    main()
