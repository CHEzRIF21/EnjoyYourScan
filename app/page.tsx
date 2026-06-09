import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">EnjoyYourScan</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Plateforme de commande par QR code pour les restaurants.
      </p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-sm">
        <Link
          href="/menu/demo"
          className="rounded-lg border p-4 hover:bg-accent transition-colors text-center"
        >
          Interface Client
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border p-4 hover:bg-accent transition-colors text-center"
        >
          Dashboard Restaurant
        </Link>
        <Link
          href="/kitchen"
          className="rounded-lg border p-4 hover:bg-accent transition-colors text-center"
        >
          Écran Cuisine (KDS)
        </Link>
        <Link
          href="/admin"
          className="rounded-lg border p-4 hover:bg-accent transition-colors text-center"
        >
          Super Admin
        </Link>
      </div>
    </main>
  );
}
