"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import {
  createTableAction,
  updateTableAction,
  deleteTableAction,
  toggleTableOpenAction,
  type ActionState,
} from "@/app/(dashboard)/dashboard/tables/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: number;
  label: string | null;
  qr_token: string;
  is_open: boolean;
  is_occupied: boolean;
  created_at: string;
}

function getQrUrl(qrToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/t/${qrToken}`;
}

// ─────────────────────────────────────────────
// Boutons submit
// ─────────────────────────────────────────────
function SubmitButton({ label, variant = "default", size = "default" }: {
  label: string;
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  size?: "default" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

// ─────────────────────────────────────────────
// Formulaire d'ajout de table
// ─────────────────────────────────────────────
function AddTableForm() {
  const [state, formAction] = useFormState(createTableAction, {});
  const [key, setKey] = useState(0);

  // Reset form on success
  useEffect(() => {
    if (state.success) setKey((k) => k + 1);
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ajouter une table</CardTitle>
      </CardHeader>
      <form key={key} action={formAction}>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="table_number">Numéro *</Label>
            <Input
              id="table_number"
              name="table_number"
              type="number"
              min={1}
              max={999}
              required
              placeholder="1"
              className="w-24"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[140px]">
            <Label htmlFor="label">Libellé (facultatif)</Label>
            <Input
              id="label"
              name="label"
              placeholder="Terrasse, Salon…"
            />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4">
          <span className="text-sm">
            {state.error && (
              <span className="text-destructive">{state.error}</span>
            )}
            {state.success && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {state.success}
              </span>
            )}
          </span>
          <SubmitButton label="Créer la table" />
        </CardFooter>
      </form>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Toggle Ouvrir / Fermer
// ─────────────────────────────────────────────
function ToggleOpenForm({ table }: { table: RestaurantTable }) {
  const [state, formAction] = useFormState(toggleTableOpenAction, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="table_id" value={table.id} />
      <input type="hidden" name="is_open" value={String(table.is_open)} />
      <SubmitButton
        label={table.is_open ? "Fermer" : "Ouvrir"}
        variant={table.is_open ? "outline" : "default"}
        size="sm"
      />
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────
// Formulaire d'édition inline
// ─────────────────────────────────────────────
function EditTableForm({
  table,
  onCancel,
}: {
  table: RestaurantTable;
  onCancel: () => void;
}) {
  const [state, formAction] = useFormState(updateTableAction, {});

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="table_id" value={table.id} />
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor={`edit-num-${table.id}`} className="text-xs">
            Numéro
          </Label>
          <Input
            id={`edit-num-${table.id}`}
            name="table_number"
            type="number"
            min={1}
            max={999}
            defaultValue={table.table_number}
            className="w-20 h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-1 flex-1">
          <Label htmlFor={`edit-label-${table.id}`} className="text-xs">
            Libellé
          </Label>
          <Input
            id={`edit-label-${table.id}`}
            name="label"
            defaultValue={table.label ?? ""}
            placeholder="Terrasse, Salon…"
            className="h-8 text-sm"
          />
        </div>
      </div>
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton label="Enregistrer" size="sm" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────
// Formulaire de suppression avec confirmation
// ─────────────────────────────────────────────
function DeleteTableForm({ table }: { table: RestaurantTable }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useFormState(deleteTableAction, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="table_id" value={table.id} />
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Confirmer ?</span>
          <SubmitButton label="Oui, supprimer" variant="destructive" size="sm" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Non
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          Supprimer
        </Button>
      )}
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────
// Carte d'une table
// ─────────────────────────────────────────────
function TableCard({
  table,
  canManage,
}: {
  table: RestaurantTable;
  canManage: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const qrUrl = getQrUrl(table.qr_token);

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `table-${table.table_number}${table.label ? `-${table.label}` : ""}-qr.png`;
      a.click();
    } catch (e) {
      console.error("QR download error:", e);
    }
  }, [qrUrl, table.table_number, table.label]);

  const handleCancel = useCallback(() => setIsEditing(false), []);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              Table {table.table_number}
              {table.label && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {table.label}
                </span>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={table.is_open ? "default" : "secondary"}>
              {table.is_open ? "Ouverte" : "Fermée"}
            </Badge>
            <Badge variant={table.is_occupied ? "destructive" : "outline"}>
              {table.is_occupied ? "Occupée" : "Libre"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex gap-4 pt-2 pb-2">
        {/* QR code */}
        <div className="shrink-0 border rounded-lg p-1.5 bg-white">
          <QRCodeSVG value={qrUrl} size={88} />
        </div>

        {/* Infos + formulaire édition */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <EditTableForm table={table} onCancel={handleCancel} />
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground break-all">{qrUrl}</p>
              <p className="text-xs text-muted-foreground">
                Token : <span className="font-mono">{table.qr_token.slice(0, 8)}…</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <Separator />

      <CardFooter className="pt-3 pb-3 flex flex-wrap items-center gap-2 justify-between">
        {/* Actions QR */}
        <Button variant="outline" size="sm" onClick={handleDownload}>
          Télécharger QR
        </Button>

        {/* Actions gestion (owner/manager) */}
        {canManage && !isEditing && (
          <div className="flex items-center gap-2 ml-auto">
            <ToggleOpenForm table={table} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Modifier
            </Button>
            <DeleteTableForm table={table} />
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Composant principal avec Realtime
// ─────────────────────────────────────────────
interface TablesClientProps {
  initialTables: RestaurantTable[];
  restaurantId: string;
  canManage: boolean;
}

export function TablesClient({
  initialTables,
  restaurantId,
  canManage,
}: TablesClientProps) {
  const [tables, setTables] = useState<RestaurantTable[]>(initialTables);

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`tables-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "restaurant_tables",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setTables((prev) => {
            const next = [...prev, payload.new as RestaurantTable];
            return next.sort((a, b) => a.table_number - b.table_number);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurant_tables",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setTables((prev) =>
            prev.map((t) =>
              t.id === payload.new.id ? (payload.new as RestaurantTable) : t
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "restaurant_tables",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setTables((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout */}
      {canManage && <AddTableForm />}

      {/* Grille des tables */}
      {tables.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Aucune table créée.</p>
          {canManage && (
            <p className="text-sm mt-1">
              Utilisez le formulaire ci-dessus pour ajouter votre première table.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <TableCard key={table.id} table={table} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
