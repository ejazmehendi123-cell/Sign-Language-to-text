/**
 * Clerk Speech-to-Text Adapters
 * Primary: Web Speech API (Browser on-device STT, $0 cost, zero cloud STT calls)
 * Fallback: Typed Input only
 */

import { SpeechToTextAdapter } from './types';

// SpeechRecognition global type helper
type SpeechRecognitionType = any;

export class WebSpeechAdapter implements SpeechToTextAdapter {
  private recognition: SpeechRecognitionType | null = null;
  private isListening = false;

  constructor() {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-IN'; // Default to Indian English, can also match hi-IN
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  start(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: string) => void
  ): void {
    if (!this.recognition) {
      onError('Web Speech API is not supported in this browser. Please use typed input.');
      return;
    }

    if (this.isListening) return;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript.trim()) {
        onResult(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      onError(`Speech recognition error: ${event.error}`);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e: any) {
      onError(e.message || 'Failed to start speech recognition');
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
    }
  }

  getAdapterName(): string {
    return 'Web Speech API (Browser STT)';
  }
}

export class TypedOnlySpeechAdapter implements SpeechToTextAdapter {
  isAvailable(): boolean {
    return false;
  }

  start(_onResult: (text: string, isFinal: boolean) => void, onError: (err: string) => void): void {
    onError('Speech recognition is disabled. Please type responses directly.');
  }

  stop(): void {}

  getAdapterName(): string {
    return 'Typed Input (Zero Audio)';
  }
}

export function createSpeechToTextAdapter(enabled: boolean = true): SpeechToTextAdapter {
  if (enabled && typeof window !== 'undefined') {
    const adapter = new WebSpeechAdapter();
    if (adapter.isAvailable()) {
      return adapter;
    }
  }
  return new TypedOnlySpeechAdapter();
}
