"use client";

import { useTransition } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/(dashboard)/auth/actions";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) {
        const msg = document.getElementById("signup-error");
        if (msg) msg.textContent = result.error;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="restaurant_name" className="text-sm font-medium">
          Nom du restaurant
        </label>
        <input
          id="restaurant_name"
          name="restaurant_name"
          type="text"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Le Saveur du Bénin"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="full_name" className="text-sm font-medium">
          Votre nom complet
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          autoComplete="name"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Jean Dupont"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="vous@restaurant.com"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="8 caractères minimum"
        />
      </div>

      <p id="signup-error" className="text-sm text-destructive min-h-[20px]" />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Création en cours…" : "Créer mon restaurant"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
