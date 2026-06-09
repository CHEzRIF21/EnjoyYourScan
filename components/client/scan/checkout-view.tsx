"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, type CartItem } from "./types";

interface Props {
  cart: CartItem[];
  currency: string;
  totalAmount: number;
  onUpdateQty: (itemId: string, newQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onBack: () => void;
  onPlaceOrder: (
    orderType: "dine_in" | "takeaway",
    targetTableNumber: string
  ) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

export function CheckoutView({
  cart,
  currency,
  totalAmount,
  onUpdateQty,
  onRemoveItem,
  onBack,
  onPlaceOrder,
  isSubmitting,
  submitError,
}: Props) {
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | null>(null);
  const [showOtherTable, setShowOtherTable] = useState(false);
  const [targetTable, setTargetTable] = useState("");

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-[40vh]">
        <p className="text-4xl mb-3">🛒</p>
        <p className="text-sm mb-4">Votre panier est vide.</p>
        <Button variant="outline" onClick={onBack}>
          Voir le menu
        </Button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!orderType || isSubmitting) return;
    await onPlaceOrder(orderType, targetTable);
  }

  return (
    <div className="px-4 py-5 space-y-6 pb-10">
      {/* ── Articles du panier ── */}
      <section>
        <h2 className="text-base font-semibold mb-3">Mon panier</h2>
        <div className="space-y-2">
          {cart.map((ci) => (
            <div
              key={ci.itemId}
              className="flex items-center gap-3 p-3 rounded-2xl border bg-card"
            >
              {ci.photo_url && (
                <div className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-muted border">
                  <Image
                    src={ci.photo_url}
                    alt={ci.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ci.name}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(ci.price * ci.quantity, currency)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 rounded-full p-0"
                  onClick={() => onUpdateQty(ci.itemId, ci.quantity - 1)}
                  aria-label="Retirer un"
                >
                  <Minus size={14} />
                </Button>
                <span className="text-sm font-bold w-5 text-center tabular-nums">
                  {ci.quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 rounded-full p-0"
                  onClick={() => onUpdateQty(ci.itemId, ci.quantity + 1)}
                  aria-label="Ajouter un"
                >
                  <Plus size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-destructive ml-1"
                  onClick={() => onRemoveItem(ci.itemId)}
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator className="mt-4 mb-3" />
        <div className="flex justify-between items-center font-semibold text-base px-1">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(totalAmount, currency)}</span>
        </div>
      </section>

      {/* ── Type de commande ── */}
      <section>
        <h2 className="text-base font-semibold mb-3">Sur place ou à emporter ?</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOrderType("dine_in")}
            className={`p-4 rounded-2xl border-2 text-center transition-all active:scale-95 ${
              orderType === "dine_in"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 bg-card"
            }`}
          >
            <p className="text-3xl mb-1.5">🍽️</p>
            <p className="text-sm font-medium">Sur place</p>
          </button>
          <button
            onClick={() => {
              setOrderType("takeaway");
              setShowOtherTable(false);
              setTargetTable("");
            }}
            className={`p-4 rounded-2xl border-2 text-center transition-all active:scale-95 ${
              orderType === "takeaway"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 bg-card"
            }`}
          >
            <p className="text-3xl mb-1.5">🥡</p>
            <p className="text-sm font-medium">À emporter</p>
          </button>
        </div>

        {/* Commander pour une autre table (option discrète) */}
        {orderType === "dine_in" && (
          <div className="mt-3">
            <button
              onClick={() => setShowOtherTable((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {showOtherTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Commander pour une autre table
            </button>
            {showOtherTable && (
              <div className="flex items-center gap-3 mt-2">
                <Label htmlFor="other-table" className="text-xs whitespace-nowrap">
                  N° de table
                </Label>
                <Input
                  id="other-table"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="ex. 12"
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className="h-9 text-sm max-w-[110px]"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Erreur ── */}
      {submitError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-xl p-3">
          {submitError}
        </p>
      )}

      {/* ── Bouton commander ── */}
      <Button
        className="w-full h-14 text-base font-semibold rounded-2xl"
        disabled={!orderType || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Envoi en cours…" : "Commander et payer"}
      </Button>
    </div>
  );
}
