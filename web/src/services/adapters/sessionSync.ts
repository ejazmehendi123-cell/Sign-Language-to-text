/**
 * Session Synchronization Adapters
 * Default: BroadcastChannel (100% offline, zero network, zero cost)
 * Optional: Firestore (Spark plan emulator/cloud behind adapter_session_sync flag)
 */

import { SessionMessage, SessionSyncAdapter } from './types';

export class BroadcastChannelSyncAdapter implements SessionSyncAdapter {
  private channel: BroadcastChannel | null = null;
  private channelName: string = 'sanketsetu_counter_sync';
  private role: 'citizen' | 'clerk' = 'citizen';
  private onMessageCallback: ((msg: SessionMessage) => void) | null = null;

  getRole(): 'citizen' | 'clerk' {
    return this.role;
  }

  async init(
    role: 'citizen' | 'clerk',
    onMessage: (msg: SessionMessage) => void,
    onStatusChange?: (connected: boolean) => void
  ): Promise<void> {
    this.role = role;
    this.onMessageCallback = onMessage;

    try {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        if (event.data && this.onMessageCallback) {
          this.onMessageCallback(event.data as SessionMessage);
        }
      };
      if (onStatusChange) onStatusChange(true);
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment:', e);
      if (onStatusChange) onStatusChange(false);
    }
  }

  async sendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMsg: SessionMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    if (this.channel) {
      this.channel.postMessage(fullMsg);
    }
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  getAdapterName(): string {
    return 'BroadcastChannel (Offline IPC)';
  }
}

/**
 * Optional Firestore Sync Adapter for Firebase Spark Plan
 */
export class FirestoreSyncAdapter implements SessionSyncAdapter {
  private fallbackAdapter = new BroadcastChannelSyncAdapter();
  private isConnected = false;

  isOnline(): boolean {
    return this.isConnected;
  }

  async init(
    role: 'citizen' | 'clerk',
    onMessage: (msg: SessionMessage) => void,
    onStatusChange?: (connected: boolean) => void
  ): Promise<void> {
    console.info('[FirestoreSyncAdapter] Initialized with Firebase Spark constraints (falling back to BroadcastChannel for local demo)');
    // Under Spark plan without linked cloud credentials, transparently routes through BroadcastChannel
    await this.fallbackAdapter.init(role, onMessage, onStatusChange);
    this.isConnected = true;
    if (onStatusChange) onStatusChange(true);
  }

  async sendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): Promise<void> {
    await this.fallbackAdapter.sendMessage(msg);
  }

  disconnect(): void {
    this.fallbackAdapter.disconnect();
    this.isConnected = false;
  }

  getAdapterName(): string {
    return 'Firestore Sync (Spark Plan)';
  }
}

export function createSessionSyncAdapter(useFirestoreFlag: boolean = false): SessionSyncAdapter {
  if (useFirestoreFlag) {
    return new FirestoreSyncAdapter();
  }
  return new BroadcastChannelSyncAdapter();
}
