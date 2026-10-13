import { RecordedTake, SignerConsent } from '../types';

const DB_NAME = 'isl_kiosk_recorder_db';
const DB_VERSION = 1;

const STORES = {
  TAKES: 'takes',
  CONSENTS: 'consents',
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.TAKES)) {
        const takeStore = db.createObjectStore(STORES.TAKES, { keyPath: 'take_id' });
        takeStore.createIndex('signer_id', 'signer_id', { unique: false });
        takeStore.createIndex('label', 'label', { unique: false });
        takeStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CONSENTS)) {
        db.createObjectStore(STORES.CONSENTS, { keyPath: 'signer_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTake(take: RecordedTake): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TAKES], 'readwrite');
    const store = transaction.objectStore(STORES.TAKES);
    const request = store.put(take);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTakes(): Promise<RecordedTake[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TAKES], 'readonly');
    const store = transaction.objectStore(STORES.TAKES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTake(takeId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TAKES], 'readwrite');
    const store = transaction.objectStore(STORES.TAKES);
    const request = store.delete(takeId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearTakes(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.TAKES], 'readwrite');
    const store = transaction.objectStore(STORES.TAKES);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveConsent(consent: SignerConsent): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.CONSENTS], 'readwrite');
    const store = transaction.objectStore(STORES.CONSENTS);
    const request = store.put(consent);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getConsent(signerId: string): Promise<SignerConsent | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.CONSENTS], 'readonly');
    const store = transaction.objectStore(STORES.CONSENTS);
    const request = store.get(signerId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllConsents(): Promise<SignerConsent[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.CONSENTS], 'readonly');
    const store = transaction.objectStore(STORES.CONSENTS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
