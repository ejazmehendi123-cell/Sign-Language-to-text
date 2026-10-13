# Privacy Architecture & Verification Guarantee

## Non-Negotiable Privacy Mandate
Under no circumstances does camera video, raw image data, or audio leave the kiosk device or get stored to persistent disk during normal recognition operations.

1. **Pure Landmark Processing:**
   - The browser webcam stream is ingested into an HTML5 `<video>` or `OffscreenCanvas` element.
   - MediaPipe Tasks Vision extracts geometric keypoint coordinates (`x, y, z`, plus visibility flags) in browser RAM.
   - The original image frame is discarded immediately from memory upon landmark extraction.

2. **Zero Storage of Biometric Imagery:**
   - Neither the live kiosk nor the data recorder tools ever serialize pixel arrays, video clips, or JPEG/PNG stills to disk or network.
   - The data recorder saves strictly numerical coordinate time-series and component presence masks.

3. **Pseudonymous Consent & Revocation:**
   - All recorded sessions during dataset collection require explicit signed digital consent before camera activation.
   - Signers are assigned random pseudonymous identifiers (`signer_YYYYMMDD_xxxx`).
   - If a participant requests data withdrawal, their takes are purged across splits by querying their signer ID.

4. **Network Request Auditing:**
   - Automated tests (`tests/privacy_audit.ts` / audit scripts) inspect all outbound network requests from the web runtime to ensure zero telemetry, analytics, or payload containing image data.
