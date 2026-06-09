interface MenuPageProps {
  params: {
    restaurantSlug: string;
  };
  searchParams: {
    table?: string;
  };
}

export default function MenuPage({ params, searchParams }: MenuPageProps) {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">Menu</h1>
      <p className="text-muted-foreground">
        Restaurant: {params.restaurantSlug} — Table: {searchParams.table ?? "—"}
      </p>
    </main>
  );
}
