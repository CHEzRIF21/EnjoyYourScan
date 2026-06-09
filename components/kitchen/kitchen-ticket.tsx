"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  startPreparingAction,
  markReadyAction,
} from "@/app/(kitchen)/kitchen/actions";
import type {
  KitchenOrder,
  KitchenOrderItem,
  KitchenTable,
  KitchenMenuItem,
} from "@/app/(kitchen)/kitchen/page";

function BigButton({
  label,
  variant,
}: {
  label: string;
  variant: "start" | "ready";
}) {
  const { pending } = useFormStatus();
  const base =
    "w-full py-4 text-lg font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50";
  const color =
    variant === "start"
      ? "bg-amber-500 text-black hover:bg-amber-400"
      : "bg-emerald-500 text-black hover:bg-emerald-400";
  return (
    <button type="submit" disabled={pending} className={`${base} ${color}`}>
      {pending ? "…" : label}
    </button>
  );
}

function ElapsedTimer({
  createdAt,
  maxMinutes,
}: {
  createdAt: string;
  maxMinutes: number;
}) {
  const [elapsed, setElapsed] = useState(() => getElapsedSec(createdAt));

  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsedSec(createdAt)), 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const overdue = maxMinutes > 0 && minutes >= maxMinutes;

  return (
    <span
      className={`font-mono text-2xl font-bold tabular-nums ${
        overdue ? "text-red-500 animate-pulse" : "text-gray-300"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      {maxMinutes > 0 && (
        <span className="text-sm text-gray-500 ml-1">/ {maxMinutes}min</span>
      )}
    </span>
  );
}

function getElapsedSec(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

interface Props {
  order: KitchenOrder;
  items: KitchenOrderItem[];
  tableMap: Record<string, KitchenTable>;
  menuMap: Record<string, KitchenMenuItem>;
  isNew: boolean;
}

export function KitchenTicket({ order, items, tableMap, menuMap, isNew }: Props) {
  const [startState, startAction] = useFormState(startPreparingAction, {});
  const [readyState, readyAction] = useFormState(markReadyAction, {});

  const table = order.table_id ? tableMap[order.table_id] : null;

  const maxPrepMinutes = items.reduce((sum, oi) => {
    const mi = menuMap[oi.menu_item_id];
    return sum + (mi?.prep_time_minutes ?? 0) * oi.quantity;
  }, 0);

  const headerLabel = table
    ? `TABLE ${table.table_number}${table.label ? ` · ${table.label}` : ""}`
    : `EMPORTER #${order.order_number}`;

  return (
    <div
      className={`
        flex flex-col rounded-2xl border-2 overflow-hidden transition-all
        ${order.status === "new"
          ? "border-amber-500/60 bg-gray-900"
          : "border-emerald-500/40 bg-gray-900/80"
        }
        ${isNew ? "ring-4 ring-amber-400/50 animate-[pulse_1s_ease-in-out_3]" : ""}
      `}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          order.status === "new" ? "bg-amber-500/10" : "bg-emerald-500/10"
        }`}
      >
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
            {headerLabel}
          </p>
          <p className="text-3xl font-black text-white leading-tight">
            #{order.order_number}
          </p>
        </div>
        <ElapsedTimer createdAt={order.created_at} maxMinutes={maxPrepMinutes} />
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-3 space-y-1.5">
        {items.map((oi) => {
          const mi = menuMap[oi.menu_item_id];
          return (
            <div key={oi.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white min-w-[2.5rem] text-right">
                  {oi.quantity}×
                </span>
                <span className="text-lg font-semibold text-white">
                  {mi?.name ?? "???"}
                </span>
              </div>
              {oi.notes && (
                <p className="ml-[2.5rem] text-sm text-amber-400 italic pl-2 border-l-2 border-amber-500/40">
                  {oi.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4 pt-2 space-y-2">
        {order.status === "new" && (
          <form action={startAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="updated_at" value={order.updated_at} />
            <BigButton label="COMMENCER" variant="start" />
          </form>
        )}
        {order.status === "preparing" && (
          <form action={readyAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="updated_at" value={order.updated_at} />
            <BigButton label="PRÊT !" variant="ready" />
          </form>
        )}

        {startState.error && (
          <p className="text-sm text-red-400 text-center">{startState.error}</p>
        )}
        {readyState.error && (
          <p className="text-sm text-red-400 text-center">{readyState.error}</p>
        )}
      </div>
    </div>
  );
}
