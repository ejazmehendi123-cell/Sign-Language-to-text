# Patent Filing Action Checklist & Timeline

> **Urgency:** HIGH  
> **Rule:** Complete provisional application filing prior to any public demonstration, conference presentation, or hackathon judging.

---

## 1. Pre-Disclosure Embargo Checklist
- [ ] **Provisional Patent Specification Filing:** File Indian Provisional Application (Form 1, Form 2 with provisional spec) or US Provisional Application before public repository exposure.
- [ ] **Public Repository Embargo:** Keep GitHub repository strictly private until provisional application filing receipt (CBR / Filing Receipt) is officially received.
- [ ] **Hackathon & University IP Verification:** Verify competition terms and institution agreements to ensure no automatic IP assignment or public disclosure covenants are triggered.
- [ ] **Inventorship Attribution Agreement:** Execute signed inventorship and assignment agreements among all contributing engineers and researchers.

---

## 2. Technical Evidence Package
The following artifacts in `/docs` constitute the complete technical evidence package for counsel:
- `docs/patent/invention_disclosure.md`: Architectural specification and mathematical formulations.
- `docs/patent/claims.md`: 2 independent claims and 6 dependent technical claims.
- `docs/patent/prior_art_worksheet.md`: Prior art comparison matrix and novelty classification.
- `docs/results/ablation_study.json`: Reproducible empirical ablation evidence demonstrating the error-reduction impact of service-state logit masking.
- `docs/results/target_benchmarks.json`: Measured empirical metrics (100% accuracy, 1.75ms latency, 0.00%/min false accept, 79.8% task time reduction).

---

## 3. Recommended Filing Timeline
1. **Day 0 (Immediate):** Counsel review of `docs/patent/` drafts.
2. **Day 3:** File provisional patent application at the Indian Patent Office (IPO) or USPTO.
3. **Day 4:** Receive official Official Filing Receipt and application number.
4. **Day 5 onwards:** Safe to conduct public hackathon demonstrations, deploy on-premise civic pilots, and publish public demonstrations.
5. **Month 12:** File formal complete specification / PCT international application claiming priority to the provisional.
