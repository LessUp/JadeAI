'use client';

import { MAX_RESUME_VERSIONS } from '@/lib/constants';
import type { ResumeDraftSnapshot, ResumeVersionRecord, ResumeVersionSource } from '@/types/editor';
import { areResumeDraftSnapshotsEqual, cloneResumeDraftSnapshot } from './resume-draft';

const DB_NAME = 'jadeai-resume-version-history';
const DB_VERSION = 1;
const STORE_NAME = 'resumeVersions';
const RESUME_ID_INDEX = 'resumeId';

function ensureIndexedDb(): IDBFactory {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available in this environment.');
  }

  return window.indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

async function openVersionDb(): Promise<IDBDatabase> {
  const indexedDb = ensureIndexedDb();

  return await new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' });

      if (!store.indexNames.contains(RESUME_ID_INDEX)) {
        store.createIndex(RESUME_ID_INDEX, 'resumeId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function listResumeVersions(resumeId: string): Promise<ResumeVersionRecord[]> {
  const db = await openVersionDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index(RESUME_ID_INDEX);
    const records = await requestToPromise(index.getAll(resumeId));
    await transactionToPromise(transaction);

    return (records as ResumeVersionRecord[]).sort((left, right) => right.createdAt - left.createdAt);
  } finally {
    db.close();
  }
}

export async function getResumeVersion(versionId: string): Promise<ResumeVersionRecord | null> {
  const db = await openVersionDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestToPromise(store.get(versionId));
    await transactionToPromise(transaction);

    return (record as ResumeVersionRecord | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function saveResumeVersion(input: {
  resumeId: string;
  snapshot: ResumeDraftSnapshot;
  source: ResumeVersionSource;
}): Promise<ResumeVersionRecord> {
  const existingVersions = await listResumeVersions(input.resumeId);
  const latestVersion = existingVersions[0];

  if (
    latestVersion &&
    areResumeDraftSnapshotsEqual(latestVersion.snapshot, input.snapshot)
  ) {
    return latestVersion;
  }

  const record: ResumeVersionRecord = {
    id: crypto.randomUUID(),
    resumeId: input.resumeId,
    snapshot: cloneResumeDraftSnapshot(input.snapshot),
    source: input.source,
    createdAt: Date.now(),
  };

  const db = await openVersionDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.put(record);

    for (const staleVersion of existingVersions.slice(MAX_RESUME_VERSIONS)) {
      store.delete(staleVersion.id);
    }

    await transactionToPromise(transaction);
    return record;
  } finally {
    db.close();
  }
}
