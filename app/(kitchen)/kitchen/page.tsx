export default function KitchenPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-8">Écran Cuisine (KDS)</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <p className="text-gray-400 col-span-full">
          Aucune commande en attente.
        </p>
      </div>
    </main>
  );
}
