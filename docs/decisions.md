# Architectural & Engineering Decisions Log

This document records architectural, engineering, and design decisions made throughout the development of the ISL Kiosk project. Each entry details the date, the choice made, the technical reasoning, and considered alternatives.

---

### DEC-001: Project Directory Encapsulation
- **Date:** 2026-10-13
- **Choice:** Encapsulate the entire project under `/isl-kiosk` within the workspace rather than scattering `/web`, `/ml`, `/config` directly in the user's root home directory.
- **Reason:** Prevents namespace collisions with existing personal files, documents, and other repositories in the user workspace. Ensures clean git repository boundaries.
- **Alternatives Considered:** Top-level home directory folders (rejected: messy, risk of accidental deletion or tracking of unrelated user files).

---

### DEC-002: Standalone Python Schema Validator (`tools/validate_config.py`)
- **Date:** 2026-10-13
- **Choice:** Implement JSON Schema validation using standard Python `jsonschema` with a CLI entrypoint and pre-commit hook.
- **Reason:** Enables fast, deterministic validation of all `/config` files (vocabulary, flow state machines, thresholds, feature flags) both locally and in CI before any runtime execution.
- **Alternatives Considered:** Ajv in Node.js (rejected for ML workflows where researchers and data scientists modify JSON configs and need Python-native validation without requiring Node.js).

---

### DEC-003: Landmark Recording Serialization Format
- **Date:** 2026-10-13
- **Choice:** Serialize raw recorded takes as JSON packages containing full metadata, frame timestamps, and explicit boolean masks (`pose_mask`, `left_hand_mask`, `right_hand_mask`), bundled into `.zip` archives via JSZip.
- **Reason:**
  1. JSON is transparent, inspectable, and editable for debugging.
  2. Guarantees zero byte storage of video frames.
  3. Explicit component masks prevent the common ML silent-failure of zero-filling missing landmarks without recording whether the hand was truly absent.
  4. Zip export/import operates entirely client-side without any backend.
- **Alternatives Considered:** Direct `.npy` binary serialization in browser (rejected: complex in pure JS without additional large libraries, opaque to inspect in browser console).

---

### DEC-004: On-Device Storage via IndexedDB for Recorder
- **Date:** 2026-10-13
- **Choice:** Store recorded takes and signer consent records in browser IndexedDB with export/import to single-file zip bundles.
- **Reason:**
  1. Zero server setup required for multi-signer collection drives across volunteer laptops.
  2. Complete privacy compliance: data never leaves the signer's laptop unless explicitly exported.
  3. Persists across browser tab refreshes.
- **Alternatives Considered:** LocalStorage (rejected: 5MB size limit is far too small for multi-frame landmark time-series), Central server upload (rejected: non-negotiable offline constraint and security surface).

---

### DEC-005: Mock Landmark Stream for Headless CI and Devices Without Webcams
- **Date:** 2026-10-13
- **Choice:** Build a mock stream / synthetic fixture player directly into the web landmark pipeline.
- **Reason:** MediaPipe Tasks Vision requires a real camera stream and WebGL/WebGPU context, which fails in headless CI runners or development machines with disabled webcams.
- **Alternatives Considered:** Requiring manual camera testing only (rejected: breaks automated CI testing).
