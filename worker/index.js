// ─────────────────────────────────────────────────────────────────────────────
// Service Worker custom — Background Sync + Menu cache
// Compilé par next-pwa et fusionné avec le workbox généré automatiquement.
// IMPORTANT : ce fichier s'exécute dans le contexte ServiceWorkerGlobalScope.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "enjoyyourscan-db";
const DB_VERSION = 1;
const ORDERS_STORE = "pending-orders";
const MENU_CACHE = "menu-data-v1";

// ─── IndexedDB helpers (contexte worker) ─────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE, { keyPath: "clientId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Sync des commandes en attente ───────────────────────────────────────────

async function syncPendingOrders() {
  let db;
  try {
    db = await openDB();
  } catch {
    return; // IndexedDB indisponible
  }

  const pending = await idbGetAll(db, ORDERS_STORE);
  if (pending.length === 0) return;

  const results = await Promise.allSettled(
    pending.map(async (order) => {
      const { clientId, ...payload } = order;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await idbDelete(db, ORDERS_STORE, clientId);

      // Notifie les clients ouverts que la commande a été synchronisée
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) =>
        client.postMessage({ type: "ORDER_SYNCED", clientId })
      );
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    // Relance un sync plus tard pour les commandes échouées
    throw new Error(`${failed} commande(s) non synchronisée(s)`);
  }
}

// ─── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-orders") {
    event.waitUntil(syncPendingOrders());
  }
});

// ─── Cache menu (NetworkFirst, fallback cache 24 h) ──────────────────────────
// Complète la stratégie workbox qui expire à 86400 s.
// On intercède UNIQUEMENT sur les routes /menu/** (pages HTML du menu client)
// car les routes /api/** sont déjà gérées par workbox NetworkFirst.

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    !url.pathname.startsWith("/menu/")
  ) {
    return; // laisse workbox gérer
  }

  event.respondWith(
    caches.open(MENU_CACHE).then(async (cache) => {
      try {
        const networkRes = await fetch(event.request);
        if (networkRes.ok) {
          cache.put(event.request, networkRes.clone());
        }
        return networkRes;
      } catch {
        const cached = await cache.match(event.request);
        return (
          cached ??
          new Response("<h1>Menu indisponible hors-ligne</h1>", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      }
    })
  );
});

// ─── Message handler (depuis les clients React) ───────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "TRIGGER_SYNC") {
    // Déclenché manuellement si Background Sync API non disponible
    syncPendingOrders().catch(() => {});
  }
});
