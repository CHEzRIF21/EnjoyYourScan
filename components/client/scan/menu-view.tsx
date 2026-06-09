"use client";

import { useRef } from "react";
import Image from "next/image";
import { Clock, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCategory, PublicMenuItem, CartItem } from "./types";
import { formatCurrency } from "./types";

interface Props {
  categories: PublicCategory[];
  cart: CartItem[];
  currency: string;
  onAdd: (item: Pick<PublicMenuItem, "id" | "name" | "price" | "photo_url">) => void;
  onRemove: (itemId: string) => void;
}

export function MenuView({ categories, cart, currency, onAdd, onRemove }: Props) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const cartMap = Object.fromEntries(cart.map((ci) => [ci.itemId, ci.quantity]));

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-[40vh]">
        <p className="text-4xl mb-3">🍽️</p>
        <p className="text-sm">Le menu n&apos;est pas encore disponible.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Onglets de catégories — défilement horizontal */}
      <div
        className="bg-background border-b px-4 py-2 flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => scrollTo(cat.id)}
            className="shrink-0 px-3 py-1.5 rounded-full text-sm border hover:bg-accent transition-colors whitespace-nowrap"
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sections du menu */}
      <div className="px-4 pt-4 pb-6 space-y-8">
        {categories.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
          >
            <h2 className="text-base font-semibold mb-3 sticky top-0 bg-background/95 backdrop-blur py-1 -mx-4 px-4">
              {cat.name}
            </h2>
            <div className="space-y-2.5">
              {cat.items.map((item) => {
                const qty = cartMap[item.id] ?? 0;
                return <ItemCard key={item.id} item={item} qty={qty} currency={currency} onAdd={onAdd} onRemove={onRemove} />;
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  qty,
  currency,
  onAdd,
  onRemove,
}: {
  item: PublicMenuItem;
  qty: number;
  currency: string;
  onAdd: (item: Pick<PublicMenuItem, "id" | "name" | "price" | "photo_url">) => void;
  onRemove: (itemId: string) => void;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-2xl border bg-card">
      {item.photo_url && (
        <div className="relative shrink-0 h-[72px] w-[72px] rounded-xl overflow-hidden bg-muted border">
          <Image src={item.photo_url} alt={item.name} fill className="object-cover" unoptimized />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="font-medium text-sm leading-snug">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-auto">
          <span className="text-sm font-semibold">{formatCurrency(item.price, currency)}</span>
          {item.prep_time_minutes && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock size={10} />
              {item.prep_time_minutes} min
            </span>
          )}
        </div>
      </div>

      {/* Contrôle quantité */}
      <div className="flex flex-col items-end justify-center shrink-0 gap-1">
        {qty === 0 ? (
          <Button
            size="sm"
            className="h-10 w-10 rounded-full p-0 text-lg"
            onClick={() => onAdd(item)}
            aria-label={`Ajouter ${item.name}`}
          >
            <Plus size={18} />
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => onRemove(item.id)}
              aria-label="Retirer un"
            >
              <Minus size={16} />
            </Button>
            <span className="text-sm font-bold w-5 text-center tabular-nums">{qty}</span>
            <Button
              size="sm"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => onAdd(item)}
              aria-label="Ajouter un"
            >
              <Plus size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
