"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadCart, persistCart, clearCart } from "@/lib/client/cart-db";
import { placeOrderAction } from "@/app/(client)/t/[qr_token]/actions";
import {
  formatCurrency,
  type CartItem,
  type PublicCategory,
  type PublicMenuItem,
  type TableInfo,
  type RestaurantInfo,
} from "./types";
import { MenuView } from "./menu-view";
import { CheckoutView } from "./checkout-view";

type Step = "menu" | "checkout" | "success";

interface Props {
  qrToken: string;
  table: TableInfo;
  restaurant: RestaurantInfo;
  categories: PublicCategory[];
}

export function ScanPageClient({ qrToken, table, restaurant, categories }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    orderNumber: number;
  } | null>(null);

  // Charger le panier depuis IndexedDB au montage
  useEffect(() => {
    loadCart(qrToken).then((items) => {
      setCart(items);
      setCartLoaded(true);
    });
  }, [qrToken]);

  // Persister le panier à chaque changement
  useEffect(() => {
    if (!cartLoaded) return;
    persistCart(qrToken, cart);
  }, [cart, cartLoaded, qrToken]);

  const addToCart = useCallback(
    (item: Pick<PublicMenuItem, "id" | "name" | "price" | "photo_url">) => {
      setCart((prev) => {
        const existing = prev.find((ci) => ci.itemId === item.id);
        if (existing) {
          return prev.map((ci) =>
            ci.itemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
          );
        }
        return [
          ...prev,
          {
            itemId: item.id,
            name: item.name,
            price: item.price,
            photo_url: item.photo_url,
            quantity: 1,
          },
        ];
      });
    },
    []
  );

  const decrementCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.itemId === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((ci) => ci.itemId !== itemId);
      return prev.map((ci) =>
        ci.itemId === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
      );
    });
  }, []);

  const updateQty = useCallback((itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((ci) => ci.itemId !== itemId));
    } else {
      setCart((prev) =>
        prev.map((ci) => (ci.itemId === itemId ? { ...ci, quantity: newQty } : ci))
      );
    }
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.itemId !== itemId));
  }, []);

  const totalItems = cart.reduce((s, ci) => s + ci.quantity, 0);
  const totalAmount = cart.reduce((s, ci) => s + ci.price * ci.quantity, 0);

  async function handlePlaceOrder(
    orderType: "dine_in" | "takeaway",
    targetTableNumber: string
  ) {
    setIsSubmitting(true);
    setSubmitError(null);

    const fd = new FormData();
    fd.append("qr_token", qrToken);
    fd.append(
      "cart",
      JSON.stringify(cart.map(({ itemId, quantity }) => ({ itemId, quantity })))
    );
    fd.append("order_type", orderType);
    if (orderType === "dine_in" && targetTableNumber.trim()) {
      fd.append("target_table_number", targetTableNumber.trim());
    }

    const result = await placeOrderAction(fd);
    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
    } else if (result.orderId && result.orderNumber !== undefined) {
      await clearCart(qrToken);
      setCart([]);
      setOrderResult({ orderId: result.orderId, orderNumber: result.orderNumber });
      setStep("success");
    }
  }

  const tableLabel = table.label
    ? `${table.label} (${table.table_number})`
    : `Table ${table.table_number}`;

  return (
    <main className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ── Header ── */}
      <header className="shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur sticky top-0 z-20 flex items-center gap-3">
        {step !== "menu" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-full p-0 shrink-0"
            onClick={() => {
              setStep("menu");
              setSubmitError(null);
            }}
            aria-label="Retour au menu"
          >
            <ArrowLeft size={18} />
          </Button>
        )}
        {restaurant.logo_url && (
          <div className="relative shrink-0 h-9 w-9 rounded-full overflow-hidden bg-muted border">
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {restaurant.name}
          </p>
          <p className="text-xs text-muted-foreground">{tableLabel}</p>
        </div>
        {step === "menu" && totalItems > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="relative h-9 w-9 rounded-full p-0 shrink-0"
            onClick={() => setStep("checkout")}
            aria-label="Voir le panier"
          >
            <ShoppingCart size={18} />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {totalItems}
            </span>
          </Button>
        )}
      </header>

      {/* ── Contenu scrollable ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {step === "menu" && (
          <MenuView
            categories={categories}
            cart={cart}
            currency={restaurant.currency}
            onAdd={addToCart}
            onRemove={decrementCart}
          />
        )}
        {step === "checkout" && (
          <CheckoutView
            cart={cart}
            currency={restaurant.currency}
            totalAmount={totalAmount}
            onUpdateQty={updateQty}
            onRemoveItem={removeItem}
            onBack={() => setStep("menu")}
            onPlaceOrder={handlePlaceOrder}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
        {step === "success" && orderResult && (
          <SuccessView
            orderNumber={orderResult.orderNumber}
            orderId={orderResult.orderId}
            qrToken={qrToken}
            currency={restaurant.currency}
            onRetour={() => {
              setStep("menu");
              setOrderResult(null);
            }}
          />
        )}
      </div>

      {/* ── Barre panier fixe (step=menu uniquement) ── */}
      {step === "menu" && totalItems > 0 && (
        <div className="shrink-0 px-4 py-3 border-t bg-background shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          <Button
            className="w-full h-14 text-base rounded-2xl gap-3 justify-between"
            onClick={() => setStep("checkout")}
          >
            <span className="bg-white/20 rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold shrink-0">
              {totalItems}
            </span>
            <span className="flex-1 text-left font-semibold">Voir mon panier</span>
            <span className="tabular-nums font-semibold">
              {formatCurrency(totalAmount, restaurant.currency)}
            </span>
          </Button>
        </div>
      )}
    </main>
  );
}

// ── Écran de confirmation (pont vers Module 7 Paiement) ────────────────────
function SuccessView({
  orderNumber,
  orderId,
  qrToken,
  currency: _currency,
  onRetour,
}: {
  orderNumber: number;
  orderId: string;
  qrToken: string;
  currency: string;
  onRetour: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center min-h-[60vh] gap-4">
      <div className="text-5xl animate-bounce">✅</div>
      <div>
        <h2 className="text-xl font-semibold">Commande #{orderNumber}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Votre commande a bien été transmise en cuisine.
        </p>
      </div>
      {/* Lien vers le module paiement (Module 7) */}
      <a href={`/t/${qrToken}/pay/${orderId}`} className="w-full max-w-xs">
        <Button className="w-full h-14 text-base rounded-2xl font-semibold">
          💳&nbsp; Payer maintenant
        </Button>
      </a>
      <Button
        variant="ghost"
        className="w-full max-w-xs"
        onClick={onRetour}
      >
        Passer une autre commande
      </Button>
    </div>
  );
}
