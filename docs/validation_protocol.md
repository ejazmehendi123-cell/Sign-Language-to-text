# Model Validation & Evaluation Protocol

## 1. Golden Rules of Honest Reporting
1. **Never Report Cross-Contaminated Splits:**
   - Signer splits must be strictly disjoint between training, validation, and testing sets.
   - If signer `S01` is in training, zero takes from `S01` may appear in validation or test.
   - Violation of this rule triggers a build failure in automated evaluation.

2. **Primary Benchmark: Leave-One-Signer-Out (LOSO) Cross-Validation:**
   - In addition to a dedicated held-out test split, report LOSO mean accuracy and standard deviation across all signers.

3. **Metrics Reported:**
   - Top-1 and Top-3 accuracy on held-out signers.
   - Macro and per-class Precision, Recall, and F1-score.
   - False-Accept Rate (FAR) on the `no_sign` negative class (Target: < 2% per minute of idle interaction).
   - Expected Calibration Error (ECE) and reliability diagrams.
   - Latency distribution: p50, p95, and p99 inference time in milliseconds.

4. **Ablation Studies:**
   - Full vocabulary vs. State-aware masked vocabulary.
   - Static threshold vs. Dynamic per-state margin threshold.
