"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import {
  createItemAction,
  updateItemAction,
  type MenuItem,
} from "@/app/(dashboard)/dashboard/menu/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

interface ItemFormProps {
  categoryId: string;
  item?: MenuItem;
  onCancel: () => void;
}

export function ItemForm({ categoryId, item, onCancel }: ItemFormProps) {
  // Both hooks always called (rules of hooks) — we use the one matching the mode
  const [createState, createAction] = useFormState(createItemAction, {});
  const [updateState, updateAction] = useFormState(updateItemAction, {});

  const isEditMode = !!item;
  const formAction = isEditMode ? updateAction : createAction;
  const state = isEditMode ? updateState : createState;

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    item?.photo_url ?? null
  );

  useEffect(() => {
    if (state.success) onCancel();
  }, [state.success, onCancel]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-medium">
          {isEditMode ? "Modifier le plat" : "Nouveau plat"}
        </CardTitle>
      </CardHeader>

      <form action={formAction}>
        {isEditMode && (
          <input type="hidden" name="item_id" value={item.id} />
        )}
        <input type="hidden" name="category_id" value={categoryId} />
        {isEditMode && (
          <input
            type="hidden"
            name="existing_photo_url"
            value={item.photo_url ?? ""}
          />
        )}

        <CardContent className="space-y-3 pt-0">
          {/* Nom */}
          <div className="space-y-1">
            <Label className="text-xs">Nom *</Label>
            <Input
              name="name"
              required
              defaultValue={item?.name}
              placeholder="Poulet yassa, Thiéboudienne…"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              name="description"
              defaultValue={item?.description ?? ""}
              placeholder="Ingrédients, allergènes…"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Prix + Temps de préparation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Prix *</Label>
              <Input
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={item?.price}
                placeholder="2500"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Préparation (min)</Label>
              <Input
                name="prep_time_minutes"
                type="number"
                min="0"
                defaultValue={item?.prep_time_minutes ?? ""}
                placeholder="15"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Photo */}
          <div className="space-y-1">
            <Label className="text-xs">
              Photo (JPEG, PNG, WebP — 5 Mo max)
            </Label>
            <div className="flex items-center gap-3">
              {previewUrl && (
                <div className="relative shrink-0 h-14 w-14 rounded-md overflow-hidden border bg-muted">
                  <Image
                    src={previewUrl}
                    alt="aperçu"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <Input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="h-8 text-xs cursor-pointer"
              />
            </div>
          </div>

          {/* Disponibilité (mode édition uniquement) */}
          {isEditMode && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_available"
                defaultChecked={item.is_available}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs">Disponible à la commande</span>
            </label>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 pt-1 pb-3">
          <span className="text-xs">
            {state.error && (
              <span className="text-destructive">{state.error}</span>
            )}
            {state.success && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {state.success}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              Annuler
            </Button>
            <SubmitBtn label={isEditMode ? "Enregistrer" : "Ajouter"} />
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
