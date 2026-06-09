export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="max-w-lg mx-auto">{children}</div>;
}
