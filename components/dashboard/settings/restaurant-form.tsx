"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  updateRestaurantAction,
  uploadLogoAction,
  type ActionState,
} from "@/app/(dashboard)/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const CURRENCIES = [
  { value: "XOF", label: "XOF — Franc CFA (BCEAO)" },
  { value: "XAF", label: "XAF — Franc CFA (BEAC)" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dollar américain" },
  { value: "GBP", label: "GBP — Livre sterling" },
  { value: "MAD", label: "MAD — Dirham marocain" },
  { value: "DZD", label: "DZD — Dinar algérien" },
  { value: "TND", label: "TND — Dinar tunisien" },
];

interface RestaurantData {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  currency: string;
  logo_url: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

function AlertMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={
        state.error
          ? "text-sm text-destructive"
          : "text-sm text-emerald-600 dark:text-emerald-400"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

export function RestaurantForm({ restaurant }: { restaurant: RestaurantData }) {
  const [infoState, infoAction] = useFormState(updateRestaurantAction, {});
  const [logoState, logoAction] = useFormState(uploadLogoAction, {});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    restaurant.logo_url
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-6">
      {/* ── Informations générales ── */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du restaurant</CardTitle>
          <CardDescription>
            Nom, coordonnées et devise affichée sur les menus.
          </CardDescription>
        </CardHeader>
        <form action={infoAction}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du restaurant *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={restaurant.name}
                placeholder="Le Bon Goût"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={restaurant.phone ?? ""}
                  placeholder="+229 97 00 00 00"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Devise</Label>
                <Select
                  id="currency"
                  name="currency"
                  defaultValue={restaurant.currency}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={restaurant.address ?? ""}
                placeholder="Rue, quartier, ville…"
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-4">
            <AlertMessage state={infoState} />
            <SubmitButton label="Enregistrer" />
          </CardFooter>
        </form>
      </Card>

      <Separator />

      {/* ── Logo ── */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            JPEG, PNG, WebP ou GIF — 2 Mo maximum.
          </CardDescription>
        </CardHeader>
        <form action={logoAction}>
          <CardContent className="flex items-center gap-6">
            {/* Prévisualisation */}
            <div className="shrink-0 h-20 w-20 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Logo"
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="text-2xl text-muted-foreground select-none">
                  🍽
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <Input
                ref={fileInputRef}
                id="logo"
                name="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Choisissez un fichier puis cliquez sur Téléverser.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-4">
            <AlertMessage state={logoState} />
            <SubmitButton label="Téléverser" />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
