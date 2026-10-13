import { describe, it, expect } from 'vitest';
import { FlowEngine, ServiceFlow } from '../services/flowEngine';
import { TemplateSentenceEngine } from '../services/adapters/sentencePolisher';
import { BroadcastChannelSyncAdapter } from '../services/adapters/sessionSync';
import birthFlowData from '../../../config/flows/birth_certificate.json';

describe('FlowEngine Declarative State Machine & Logit Masking', () => {
  const flow = birthFlowData as unknown as ServiceFlow;

  it('initializes to the initial state and returns active vocabulary', () => {
    const engine = new FlowEngine(flow);
    expect(engine.getCurrentStateId()).toBe('select_service_type');
    expect(engine.getActiveVocab()).toEqual(['certificate', 'form', 'status', 'help']);
  });

  it('masks illegal vocabulary logits and normalizes probabilities over active vocabulary', () => {
    const engine = new FlowEngine(flow);
    const vocabList = [
      'i', 'need', 'certificate', 'birth', 'death', 'income',
      'address', 'form', 'help', 'where', 'wait', 'fee',
      'yes', 'no', 'repeat', 'slow', 'thank_you', 'name',
      'document', 'status', 'no_sign', 'unknown'
    ];

    // Raw logits where an inactive sign ('yes') has a high score, but active sign ('certificate') has high score too
    const rawLogits = new Float32Array(vocabList.length);
    rawLogits.fill(0);
    rawLogits[vocabList.indexOf('yes')] = 10.0; // Inactive in select_service_type!
    rawLogits[vocabList.indexOf('certificate')] = 5.0; // Active!

    const result = engine.maskAndClassifyLogits(rawLogits, vocabList, 1.5);

    // The inactive 'yes' should be masked out, and 'certificate' should be picked as topLabel
    expect(result.topLabel).toBe('certificate');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.isConfident).toBe(true);
  });

  it('advances state machine on confirmed sign and tracks target step', () => {
    const engine = new FlowEngine(flow);
    const step1 = engine.transition('certificate');
    expect(step1.nextStateId).toBe('confirm_documents');
    expect(step1.isCompleted).toBe(false);

    const step2 = engine.transition('yes');
    expect(step2.nextStateId).toBe('fee_payment');
  });
});

describe('Sentence Polisher Template Engine', () => {
  const engine = new TemplateSentenceEngine();

  it('generates natural sentences across English, Hindi, and Marathi', async () => {
    const en = await engine.polish(['i', 'need', 'certificate'], 'en');
    const hi = await engine.polish(['i', 'need', 'certificate'], 'hi');
    const mr = await engine.polish(['i', 'need', 'certificate'], 'mr');

    expect(en).toContain('certificate');
    expect(hi).toContain('प्रमाणपत्र');
    expect(mr).toContain('प्रमाणपत्र');
  });
});

describe('BroadcastChannel Session Sync Adapter', () => {
  it('instantiates and provides offline IPC adapter name', () => {
    const adapter = new BroadcastChannelSyncAdapter();
    expect(adapter.getAdapterName()).toContain('BroadcastChannel');
    expect(adapter.getRole()).toBe('citizen');
  });
});
