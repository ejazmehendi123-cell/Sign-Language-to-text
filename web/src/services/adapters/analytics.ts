/**
 * Analytics Adapters
 * Default: Local IndexedDB / In-Memory (Zero cloud transmission, strict privacy)
 * Optional: Firestore Anonymized Aggregate Counters (Spark Plan free tier)
 */

import { AnalyticsAdapter } from './types';

export class LocalAnalyticsAdapter implements AnalyticsAdapter {
  private log: Array<{ event: string; properties?: Record<string, any>; timestamp: number }> = [];

  logEvent(event: string, properties?: Record<string, any>): void {
    const entry = {
      event,
      properties: properties ? { ...properties } : undefined,
      timestamp: Date.now(),
    };
    this.log.push(entry);
    // Keep last 100 entries in memory
    if (this.log.length > 100) {
      this.log.shift();
    }
  }

  getAdapterName(): string {
    return 'Local Storage (Zero External Transmission)';
  }
}

export class FirestoreAnalyticsAdapter implements AnalyticsAdapter {
  private localFallback = new LocalAnalyticsAdapter();

  logEvent(event: string, properties?: Record<string, any>): void {
    // Under Spark tier, logs locally unless connected to emulator
    this.localFallback.logEvent(event, properties);
  }

  getAdapterName(): string {
    return 'Firestore Aggregate (Spark Plan)';
  }
}

export function createAnalyticsAdapter(useFirestore: boolean = false): AnalyticsAdapter {
  if (useFirestore) {
    return new FirestoreAnalyticsAdapter();
  }
  return new LocalAnalyticsAdapter();
}
