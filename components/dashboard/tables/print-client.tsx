"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

interface PrintTable {
  id: string;
  table_number: number;
  label: string | null;
  qr_token: string;
  is_open: boolean;
}

interface PrintClientProps {
  tables: PrintTable[];
  restaurantName: string;
}

function getQrUrl(qrToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/t/${qrToken}`;
}

export function PrintClient({ tables, restaurantName }: PrintClientProps) {
  const handlePrint = () => window.print();

  return (
    <>
      {/* Styles d'impression injectés inline */}
      <style>{`
        @media print {
          body { background: white; }
          aside,
          [data-sidebar],
          .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .print-page { padding: 12mm !important; }
          .qr-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8mm !important;
          }
          .qr-card {
            border: 1px solid #e5e7eb !important;
            border-radius: 4mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
      `}</style>

      <div className="print-page max-w-5xl mx-auto px-4 py-8">
        {/* En-tête (masqué à l'impression) */}
        <div className="no-print flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Impression des QR codes</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {restaurantName} — {tables.length} table{tables.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={handlePrint} className="print:hidden">
            Imprimer (A4)
          </Button>
        </div>

        {/* Titre imprimé */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold text-center">{restaurantName}</h1>
          <p className="text-center text-sm text-gray-500">QR codes des tables</p>
        </div>

        {tables.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Aucune table à imprimer.
          </div>
        ) : (
          <div className="qr-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => {
              const url = getQrUrl(table.qr_token);
              return (
                <div
                  key={table.id}
                  className="qr-card border rounded-xl p-4 flex flex-col items-center gap-3 text-center"
                >
                  <div className="bg-white p-2 rounded-lg border">
                    <QRCodeSVG
                      value={url}
                      size={160}
                      includeMargin={false}
                    />
                  </div>

                  <div>
                    <p className="text-xl font-bold">Table {table.table_number}</p>
                    {table.label && (
                      <p className="text-sm text-gray-500">{table.label}</p>
                    )}
                    {!table.is_open && (
                      <p className="text-xs text-orange-500 mt-1 font-medium">
                        Table fermée
                      </p>
                    )}
                  </div>

                  <p className="text-[8px] text-gray-400 break-all leading-tight">
                    {url}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
