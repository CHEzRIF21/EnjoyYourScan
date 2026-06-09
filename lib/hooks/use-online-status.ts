"use client";

import { useCallback, useEffect, useState } from "react";
import { countPendingOrders, requestSync } from "@/lib/db/pending-orders";

export interface OnlineStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  /** Déclenche manuellement la synchronisation des commandes en attente */
  triggerSync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await countPendingOrders();
      setPendingCount(count);
    } catch {
      // IndexedDB non disponible (SSR ou private browsing)
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await requestSync();
      // Attend 2 s pour laisser le SW traiter avant de recompter
      await new Promise((r) => setTimeout(r, 2000));
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    function handleOnline() {
      setIsOnline(true);
      // Lance la sync automatiquement au retour de connexion
      requestSync().catch(() => {});
      // Recompte après un délai pour laisser le SW traiter
      setTimeout(refreshPendingCount, 3000);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Écoute les messages du service worker (ORDER_SYNCED)
    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type === "ORDER_SYNCED") {
        refreshPendingCount();
      }
    }

    navigator.serviceWorker.addEventListener("message", handleSWMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleSWMessage);
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, triggerSync };
}
