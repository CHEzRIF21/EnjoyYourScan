export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-slate-900 text-white p-4">
        <p className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-400">
          Super Admin
        </p>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
