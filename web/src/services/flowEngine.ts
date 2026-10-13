/**
 * SanketSetu Declarative Service Flow Engine
 * Manages state machine transitions and performs dynamic logit masking per workflow step.
 */

export interface FlowStateDef {
  id: string;
  prompt: { en: string; hi: string; mr: string };
  clerk_hint: { en: string; hi: string; mr: string };
  active_vocab: string[];
  confidence_threshold: number;
  min_margin: number;
  transitions: Record<string, string>;
  timeout_seconds: number;
  on_timeout: string;
  required_documents?: string[];
  fee?: { amount_inr: number; exemptions?: string };
}

export interface ServiceFlow {
  service_id: string;
  service_name: { en: string; hi: string; mr: string };
  description: string;
  initial_state: string;
  states: Record<string, FlowStateDef>;
}

export interface RecognitionResult {
  topLabel: string;
  confidence: number;
  margin: number;
  isConfident: boolean;
  latencyMs: number;
  needsRetry: boolean;
}

export class FlowEngine {
  private flow: ServiceFlow;
  private currentStateId: string;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(flow: ServiceFlow, maxRetries: number = 3) {
    this.flow = flow;
    this.currentStateId = flow.initial_state;
    this.maxRetries = maxRetries;
  }

  getCurrentStateId(): string {
    return this.currentStateId;
  }

  getCurrentState(): FlowStateDef {
    return this.flow.states[this.currentStateId] || this.flow.states[this.flow.initial_state];
  }

  getFlow(): ServiceFlow {
    return this.flow;
  }

  getActiveVocab(): string[] {
    const state = this.getCurrentState();
    return state.active_vocab || [];
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Dynamic logit masking:
   * Masks logits of illegal vocabulary classes to -1e9,
   * then computes softmax and margin strictly across the allowed vocabulary for this step.
   */
  maskAndClassifyLogits(
    rawLogits: Float32Array,
    vocabClasses: string[],
    latencyMs: number = 0
  ): RecognitionResult {
    const currentState = this.getCurrentState();
    const activeVocabSet = new Set(currentState.active_vocab);
    const threshold = currentState.confidence_threshold;
    const minMargin = currentState.min_margin;

    // Mask non-active logits
    const maskedLogits = new Float32Array(rawLogits.length);
    let maxLogit = -Infinity;

    for (let i = 0; i < rawLogits.length; i++) {
      const className = vocabClasses[i];
      if (activeVocabSet.has(className)) {
        maskedLogits[i] = rawLogits[i];
        if (maskedLogits[i] > maxLogit) {
          maxLogit = maskedLogits[i];
        }
      } else {
        maskedLogits[i] = -1e9;
      }
    }

    // Stable Softmax
    let sumExp = 0.0;
    const expScores = new Float32Array(rawLogits.length);
    for (let i = 0; i < rawLogits.length; i++) {
      if (maskedLogits[i] > -1e8) {
        expScores[i] = Math.exp(maskedLogits[i] - maxLogit);
        sumExp += expScores[i];
      } else {
        expScores[i] = 0.0;
      }
    }

    const probabilities: { className: string; prob: number }[] = [];
    for (let i = 0; i < rawLogits.length; i++) {
      if (activeVocabSet.has(vocabClasses[i])) {
        probabilities.push({
          className: vocabClasses[i],
          prob: sumExp > 0 ? expScores[i] / sumExp : 0,
        });
      }
    }

    probabilities.sort((a, b) => b.prob - a.prob);

    if (probabilities.length === 0) {
      return {
        topLabel: 'unknown',
        confidence: 0,
        margin: 0,
        isConfident: false,
        latencyMs,
        needsRetry: true,
      };
    }

    const top1 = probabilities[0];
    const top2Prob = probabilities.length > 1 ? probabilities[1].prob : 0.0;
    const margin = top1.prob - top2Prob;

    const isConfident = top1.prob >= threshold && margin >= minMargin;

    if (!isConfident) {
      this.retryCount++;
    } else {
      this.retryCount = 0;
    }

    return {
      topLabel: top1.className,
      confidence: top1.prob,
      margin,
      isConfident,
      latencyMs,
      needsRetry: !isConfident,
    };
  }

  /**
   * Advances the state machine upon confirmed sign detection.
   */
  transition(confirmedSign: string): {
    nextStateId: string;
    isCompleted: boolean;
    isClerkEscalated: boolean;
  } {
    const currentState = this.getCurrentState();
    const targetStateId = currentState.transitions[confirmedSign];

    if (targetStateId && this.flow.states[targetStateId]) {
      this.currentStateId = targetStateId;
      this.retryCount = 0;
    } else if (this.retryCount >= this.maxRetries) {
      // Escalate to clerk if max retries exceeded
      this.currentStateId = currentState.on_timeout || 'call_clerk';
    }

    const isCompleted = this.currentStateId === 'completed';
    const isClerkEscalated = this.currentStateId === 'call_clerk';

    return {
      nextStateId: this.currentStateId,
      isCompleted,
      isClerkEscalated,
    };
  }

  reset(): void {
    this.currentStateId = this.flow.initial_state;
    this.retryCount = 0;
  }
}
