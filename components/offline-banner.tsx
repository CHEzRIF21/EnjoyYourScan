"use client";

import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOnlineStatus();

  // Hors-ligne
  if (!isOnline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground"
      >
        <span className="h-2 w-2 rounded-full bg-destructive-foreground animate-pulse" />
        <span>
          Vous êtes hors ligne.
          {pendingCount > 0 && (
            <> {pendingCount} commande{pendingCount > 1 ? "s" : ""} en attente de synchronisation.</>
          )}
        </span>
      </div>
    );
  }

  // En ligne + commandes en attente
  if (pendingCount > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm text-white"
      >
        {isSyncing ? (
          <>
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            <span>Synchronisation des commandes en cours…</span>
          </>
        ) : (
          <>
            <span>
              {pendingCount} commande{pendingCount > 1 ? "s" : ""} non synchronisée{pendingCount > 1 ? "s" : ""}.
            </span>
            <button
              onClick={triggerSync}
              className="underline underline-offset-2 font-medium hover:no-underline"
            >
              Synchroniser maintenant
            </button>
          </>
        )}
      </div>
    );
  }

  return null;
}
