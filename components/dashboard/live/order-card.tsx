"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  advanceOrderStatusAction,
  cancelOrderAction,
} from "@/app/(dashboard)/dashboard/live/actions";
import type {
  OrderRow,
  OrderItemRow,
  TableRow,
} from "@/app/(dashboard)/dashboard/live/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

function SubmitBtn({
  label,
  variant = "default",
  size = "sm",
}: {
  label: string;
  variant?: "default" | "destructive" | "ghost" | "outline" | "secondary";
  size?: "sm" | "default";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

// ─── Minuteur temps écoulé ──────────────────────────────
function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(() => getElapsed(createdAt));

  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsed(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span
      className={`tabular-nums text-xs font-mono ${
        minutes >= 15 ? "text-destructive font-semibold" : "text-muted-foreground"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function getElapsed(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}

// ─── Labels + couleurs par statut ───────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; nextLabel: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  new: { label: "Nouvelle", nextLabel: "Préparer", variant: "default" },
  preparing: { label: "En préparation", nextLabel: "Prêt !", variant: "default" },
  ready: { label: "Prête", nextLabel: "Servir", variant: "default" },
  served: { label: "Servie", nextLabel: "Terminer", variant: "secondary" },
};

// ─── Carte commande ─────────────────────────────────────
interface Props {
  order: OrderRow;
  orderItems: OrderItemRow[];
  menuMap: Record<string, string>;
  tableMap: Record<string, TableRow>;
  canManage: boolean;
}

export function OrderCard({ order, orderItems, menuMap, tableMap, canManage }: Props) {
  const [advanceState, advanceAction] = useFormState(advanceOrderStatusAction, {});
  const [cancelState, cancelAction] = useFormState(cancelOrderAction, {});
  const [showCancel, setShowCancel] = useState(false);

  const config = STATUS_CONFIG[order.status];
  const table = order.table_id ? tableMap[order.table_id] : null;

  return (
    <Card className="text-sm">
      <CardHeader className="py-2.5 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">#{order.order_number}</span>
            {table ? (
              <Badge variant="outline" className="text-[10px]">
                T{table.table_number}
                {table.label ? ` · ${table.label}` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                À emporter
              </Badge>
            )}
          </div>
          <ElapsedTimer createdAt={order.created_at} />
        </div>
      </CardHeader>

      <CardContent className="px-3 py-0 pb-2">
        {/* Liste des plats */}
        {orderItems.length > 0 ? (
          <ul className="space-y-0.5">
            {orderItems.map((oi) => (
              <li key={oi.id} className="flex justify-between gap-2 text-xs">
                <span className="truncate">
                  <span className="font-medium">{oi.quantity}×</span>{" "}
                  {menuMap[oi.menu_item_id] ?? "Article inconnu"}
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {new Intl.NumberFormat("fr-FR").format(oi.unit_price * oi.quantity)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Chargement des articles…</p>
        )}
        {oi_notes(orderItems).length > 0 && (
          <div className="mt-1.5 text-xs text-muted-foreground italic border-l-2 pl-2">
            {oi_notes(orderItems).map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center mt-2 pt-1.5 border-t text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">
            {new Intl.NumberFormat("fr-FR").format(Number(order.total_amount))}
          </span>
        </div>
      </CardContent>

      <CardFooter className="px-3 py-2 flex flex-col gap-1.5 items-stretch">
        {/* Bouton avancer le statut */}
        {config && (
          <form action={advanceAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="current_status" value={order.status} />
            <input type="hidden" name="updated_at" value={order.updated_at} />
            <SubmitBtn label={config.nextLabel} variant={config.variant} />
          </form>
        )}

        {/* Erreur verrou optimiste */}
        {advanceState.error && (
          <p className="text-xs text-destructive">{advanceState.error}</p>
        )}

        {/* Annuler (owner/manager uniquement) */}
        {canManage && order.status !== "completed" && order.status !== "cancelled" && (
          <div>
            {showCancel ? (
              <form action={cancelAction} className="flex items-center gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="updated_at" value={order.updated_at} />
                <span className="text-xs text-muted-foreground">Annuler ?</span>
                <SubmitBtn label="Oui" variant="destructive" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancel(false)}
                >
                  Non
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs"
                onClick={() => setShowCancel(true)}
              >
                Annuler la commande
              </Button>
            )}
            {cancelState.error && (
              <p className="text-xs text-destructive mt-1">{cancelState.error}</p>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function oi_notes(items: OrderItemRow[]): string[] {
  return items.filter((oi) => oi.notes).map((oi) => oi.notes!);
}
