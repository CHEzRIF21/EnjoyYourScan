// IndexedDB — helpers côté navigateur (pas dans le service worker)

const DB_NAME = "enjoyyourscan-db";
const DB_VERSION = 1;
const ORDERS_STORE = "pending-orders";

export interface PendingOrder {
  /** Identifiant local généré côté client (crypto.randomUUID) */
  clientId: string;
  restaurantId: string;
  tableId?: string;
  type: "dine_in" | "takeaway";
  items: Array<{
    menuItemId: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }>;
  totalAmount: number;
  /** Timestamp d'enregistrement local */
  queuedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE, { keyPath: "clientId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingOrder(
  order: Omit<PendingOrder, "clientId" | "queuedAt">
): Promise<string> {
  const db = await openDB();
  const clientId = crypto.randomUUID();
  const record: PendingOrder = { ...order, clientId, queuedAt: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDERS_STORE, "readwrite");
    const req = tx.objectStore(ORDERS_STORE).add(record);
    req.onsuccess = () => resolve(clientId);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDERS_STORE, "readonly");
    const req = tx.objectStore(ORDERS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingOrder[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePendingOrder(clientId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDERS_STORE, "readwrite");
    const req = tx.objectStore(ORDERS_STORE).delete(clientId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countPendingOrders(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDERS_STORE, "readonly");
    const req = tx.objectStore(ORDERS_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enregistre un Background Sync ou envoie un message TRIGGER_SYNC
 * si la Background Sync API n'est pas disponible.
 */
export async function requestSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;

  if ("sync" in registration) {
    await (registration as ServiceWorkerRegistration & {
      sync: { register(tag: string): Promise<void> };
    }).sync.register("sync-pending-orders");
  } else {
    // Fallback : message direct au service worker
    registration.active?.postMessage({ type: "TRIGGER_SYNC" });
  }
}
