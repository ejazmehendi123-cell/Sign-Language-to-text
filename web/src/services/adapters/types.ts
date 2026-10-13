/**
 * SanketSetu Free-Tier Google Adapter Interfaces
 * Offline-first abstraction layer for session synchronization, STT, polishing, and analytics.
 */

export interface SessionMessage {
  id: string;
  sender: 'citizen' | 'clerk' | 'system';
  type: 'sign_candidate' | 'sign_confirmed' | 'clerk_reply' | 'flow_state' | 'call_clerk';
  payload: any;
  timestamp: number;
}

export interface SessionSyncAdapter {
  init(
    role: 'citizen' | 'clerk',
    onMessage: (msg: SessionMessage) => void,
    onStatusChange?: (connected: boolean) => void
  ): Promise<void>;
  sendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<void>;
  disconnect(): void;
  getAdapterName(): string;
}

export interface SpeechToTextAdapter {
  start(onResult: (text: string, isFinal: boolean) => void, onError: (err: string) => void): void;
  stop(): void;
  isAvailable(): boolean;
  getAdapterName(): string;
}

export interface SentencePolisherAdapter {
  polish(glossTokens: string[], language: string): Promise<string>;
  getAdapterName(): string;
}

export interface AnalyticsAdapter {
  logEvent(event: string, properties?: Record<string, any>): void;
  getAdapterName(): string;
}
