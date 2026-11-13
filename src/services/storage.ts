import {
  ApiErrorRecord,
  ApiKeyAccount,
  ModelPricing,
  QuotaReferenceLimit,
  UsageRecord,
} from '../types/monitor';
import { DEFAULT_PRICING_CATALOG } from '../utils/pricing';

const DB_NAME = 'GeminiPulseDB';
const DB_VERSION = 1;

const STORE_ACCOUNTS = 'accounts';
const STORE_USAGE = 'usageLogs';
const STORE_ERRORS = 'errorLogs';
const STORE_SETTINGS = 'settings';

const KEY_PRICING_CATALOG = 'pricingCatalog';
const KEY_QUOTA_REFS = 'quotaReferences';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_USAGE)) {
        db.createObjectStore(STORE_USAGE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ERRORS)) {
        db.createObjectStore(STORE_ERRORS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => {
      const row = req.result as { key: string; value: T } | undefined;
      resolve(row?.value);
    };
    req.onerror = () => reject(req.error);
  });
}

async function setSetting<T>(key: string, value: T): Promise<void> {
  await putInStore(STORE_SETTINGS, { key, value });
}

export interface LoadedMonitorState {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  quotaReferences: QuotaReferenceLimit[];
}

async function requestPersistentStorage(): Promise<void> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      const persisted = await navigator.storage.persisted();
      if (!persisted) {
        await navigator.storage.persist();
      }
    }
  } catch {
    // Storage persistence API is optional and may be restricted
  }
}

export async function loadAllMonitorData(): Promise<LoadedMonitorState> {
  try {
    void requestPersistentStorage();
    const [accounts, usageLogs, errorLogs, pricingCatalog, quotaReferences] =
      await Promise.all([
        getAllFromStore<ApiKeyAccount>(STORE_ACCOUNTS),
        getAllFromStore<UsageRecord>(STORE_USAGE),
        getAllFromStore<ApiErrorRecord>(STORE_ERRORS),
        getSetting<ModelPricing[]>(KEY_PRICING_CATALOG),
        getSetting<QuotaReferenceLimit[]>(KEY_QUOTA_REFS),
      ]);

    accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    usageLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    errorLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      accounts,
      usageLogs,
      errorLogs,
      pricingCatalog:
        pricingCatalog && pricingCatalog.length > 0
          ? pricingCatalog
          : DEFAULT_PRICING_CATALOG,
      quotaReferences: quotaReferences || [],
    };
  } catch {
    // Graceful fallback if IndexedDB is blocked
    return {
      accounts: [],
      usageLogs: [],
      errorLogs: [],
      pricingCatalog: DEFAULT_PRICING_CATALOG,
      quotaReferences: [],
    };
  }
}

export async function saveAccount(account: ApiKeyAccount): Promise<void> {
  await putInStore(STORE_ACCOUNTS, account);
}

export async function removeAccount(accountId: string): Promise<void> {
  await deleteFromStore(STORE_ACCOUNTS, accountId);
}

export async function saveUsageRecord(record: UsageRecord): Promise<void> {
  await putInStore(STORE_USAGE, record);
}

export async function clearUsageHistoryStore(): Promise<void> {
  await clearStore(STORE_USAGE);
}

export async function saveErrorRecord(record: ApiErrorRecord): Promise<void> {
  await putInStore(STORE_ERRORS, record);
}

export async function clearErrorHistoryStore(): Promise<void> {
  await clearStore(STORE_ERRORS);
}

export async function savePricingCatalog(catalog: ModelPricing[]): Promise<void> {
  await setSetting(KEY_PRICING_CATALOG, catalog);
}

export async function saveQuotaReferences(
  refs: QuotaReferenceLimit[]
): Promise<void> {
  await setSetting(KEY_QUOTA_REFS, refs);
}

export async function replaceAllFromBackup(data: {
  accounts: ApiKeyAccount[];
  usageLogs: UsageRecord[];
  errorLogs: ApiErrorRecord[];
  pricingCatalog: ModelPricing[];
  quotaReferences: QuotaReferenceLimit[];
}): Promise<void> {
  await Promise.all([
    clearStore(STORE_ACCOUNTS),
    clearStore(STORE_USAGE),
    clearStore(STORE_ERRORS),
  ]);

  for (const acc of data.accounts) {
    await putInStore(STORE_ACCOUNTS, acc);
  }
  for (const log of data.usageLogs) {
    await putInStore(STORE_USAGE, log);
  }
  for (const err of data.errorLogs) {
    await putInStore(STORE_ERRORS, err);
  }
  if (data.pricingCatalog.length > 0) {
    await savePricingCatalog(data.pricingCatalog);
  }
  await saveQuotaReferences(data.quotaReferences);
}
