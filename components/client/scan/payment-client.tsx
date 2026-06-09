"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PaymentStep = "select" | "processing" | "pending" | "success" | "failed";

interface Props {
  qrToken: string;
  orderId: string;
  orderNumber: number;
  totalAmount: number;
  currency: string;
  restaurantName: string;
  isPaid: boolean;
  stripeReturnCancelled?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export function PaymentClient({
  qrToken,
  orderId,
  orderNumber,
  totalAmount,
  currency,
  restaurantName,
  isPaid,
  stripeReturnCancelled,
}: Props) {
  const [step, setStep] = useState<PaymentStep>(isPaid ? "success" : "select");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(
    stripeReturnCancelled ? "Paiement annulé. Choisissez un autre moyen." : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [successMethod, setSuccessMethod] = useState<string | null>(
    isPaid ? "confirmed" : null
  );
  const kkiapayReady = useRef(false);

  // ── Realtime : écouter payment_confirmed sur cette commande ──
  useEffect(() => {
    if (step === "success") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`payment-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if ((payload.new as { payment_confirmed: boolean }).payment_confirmed) {
            setStep("success");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, step]);

  // ── KkiaPay listeners ──
  const handleKkiapaySuccess = useCallback(
    async (data: { transactionId: string }) => {
      setStep("pending");
      setError(null);
      try {
        const res = await fetch("/api/payments/mobile-money", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, transactionId: data.transactionId, phone }),
        });
        const result = await res.json();
        if (result.error) {
          setError(result.error);
          setStep("failed");
        }
        // Realtime subscription will flip to "success"
      } catch {
        setError("Erreur de connexion. Le paiement sera vérifié automatiquement.");
      }
    },
    [orderId, phone]
  );

  const handleKkiapayFailed = useCallback(() => {
    setError("Le paiement mobile a échoué. Réessayez ou changez de méthode.");
    setStep("failed");
  }, []);

  useEffect(() => {
    if (!kkiapayReady.current) return;
    window.addKkiapayListener("success", handleKkiapaySuccess);
    window.addKkiapayListener("failed", handleKkiapayFailed);
    return () => {
      window.removeKkiapayListener("success");
      window.removeKkiapayListener("failed");
    };
  }, [handleKkiapaySuccess, handleKkiapayFailed]);

  // ── Initier paiement Mobile Money ──
  async function handleMobileMoney() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/mobile-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      // Ouvrir le widget KkiaPay
      if (window.openKkiapayWidget) {
        window.openKkiapayWidget({
          amount: totalAmount,
          key: data.publicKey,
          sandbox: data.sandbox ?? false,
          data: orderId,
          position: "center",
        });
      } else {
        setError("Le module de paiement n'est pas chargé. Rafraîchissez la page.");
      }
    } catch {
      setError("Erreur de connexion.");
      setIsLoading(false);
    }
  }

  // ── Initier paiement Carte (Stripe Checkout) ──
  async function handleCard() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      // Rediriger vers Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Erreur de connexion.");
      setIsLoading(false);
    }
  }

  // ── Paiement Espèces ──
  async function handleCash() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      setSuccessMethod("cash");
      setStep("success");
    } catch {
      setError("Erreur de connexion.");
      setIsLoading(false);
    }
  }

  // ── RENDER ──
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* KkiaPay SDK */}
      <Script
        src="https://cdn.kkiapay.me/k.js"
        strategy="afterInteractive"
        onReady={() => {
          kkiapayReady.current = true;
          if (window.addKkiapayListener) {
            window.addKkiapayListener("success", handleKkiapaySuccess);
            window.addKkiapayListener("failed", handleKkiapayFailed);
          }
        }}
      />

      {/* Header */}
      <header className="shrink-0 px-5 py-4 border-b">
        <p className="text-sm text-muted-foreground">{restaurantName}</p>
        <p className="text-lg font-semibold">
          Commande #{orderNumber}
        </p>
        <p className="text-2xl font-bold mt-1">
          {formatCurrency(totalAmount, currency)}
        </p>
      </header>

      <div className="flex-1 px-5 py-6">
        {/* ── Sélection du moyen de paiement ── */}
        {step === "select" && (
          <div className="space-y-6 max-w-md mx-auto">
            {/* Téléphone (optionnel — pour SMS de confirmation) */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm">
                Téléphone (pour recevoir la confirmation)
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+229 97 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Choisissez votre moyen de paiement
              </p>

              {/* Mobile Money — en premier */}
              <button
                onClick={handleMobileMoney}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card text-left transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-4"
              >
                <span className="text-3xl">📱</span>
                <div>
                  <p className="font-semibold">Mobile Money</p>
                  <p className="text-xs text-muted-foreground">
                    MTN MoMo, Moov Money
                  </p>
                </div>
              </button>

              {/* Carte */}
              <button
                onClick={handleCard}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card text-left transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-4"
              >
                <span className="text-3xl">💳</span>
                <div>
                  <p className="font-semibold">Carte bancaire</p>
                  <p className="text-xs text-muted-foreground">
                    Visa, Mastercard
                  </p>
                </div>
              </button>

              {/* Espèces */}
              <button
                onClick={handleCash}
                disabled={isLoading}
                className="w-full p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card text-left transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-4"
              >
                <span className="text-3xl">💵</span>
                <div>
                  <p className="font-semibold">Espèces</p>
                  <p className="text-xs text-muted-foreground">
                    Réglez directement au serveur
                  </p>
                </div>
              </button>
            </div>

            {isLoading && (
              <p className="text-sm text-center text-muted-foreground animate-pulse">
                Préparation du paiement…
              </p>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── En attente de confirmation ── */}
        {(step === "processing" || step === "pending") && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
            <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-lg font-semibold">Paiement en cours de vérification…</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ne fermez pas cette page. Vous recevrez un SMS de confirmation.
              </p>
            </div>
          </div>
        )}

        {/* ── Succès ── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center px-4">
            <div className="text-6xl">✅</div>
            <div>
              <h2 className="text-2xl font-bold">Commande confirmée !</h2>
              <p className="text-4xl font-black mt-2">#{orderNumber}</p>
              {successMethod === "cash" ? (
                <p className="text-muted-foreground text-sm mt-3 max-w-xs">
                  Présentez-vous au serveur pour régler{" "}
                  <strong>{formatCurrency(totalAmount, currency)}</strong> en espèces.
                  Votre commande est déjà en cuisine.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm mt-3 max-w-xs">
                  Paiement reçu. Votre commande est transmise en cuisine.
                </p>
              )}
            </div>
            <a
              href={`/t/${qrToken}`}
              className="mt-4"
            >
              <Button variant="outline" size="lg" className="rounded-2xl">
                Passer une autre commande
              </Button>
            </a>
          </div>
        )}

        {/* ── Échec ── */}
        {step === "failed" && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5 text-center px-4">
            <div className="text-6xl">❌</div>
            <div>
              <h2 className="text-xl font-semibold">Paiement échoué</h2>
              {error && (
                <p className="text-sm text-destructive mt-2 max-w-xs">{error}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button
                className="h-14 text-base rounded-2xl font-semibold"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
              >
                Réessayer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
              >
                Changer de méthode
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
