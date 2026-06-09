"use client";

import type { TableRow } from "@/app/(dashboard)/dashboard/live/page";

interface Props {
  tables: TableRow[];
  tableStatuses: Record<string, string>;
}

const STATUS_STYLES: Record<string, { bg: string; ring: string; label: string }> = {
  new: { bg: "bg-blue-100 dark:bg-blue-950", ring: "ring-blue-400", label: "Nouvelle commande" },
  preparing: { bg: "bg-amber-100 dark:bg-amber-950", ring: "ring-amber-400", label: "En prép." },
  ready: { bg: "bg-emerald-100 dark:bg-emerald-950", ring: "ring-emerald-400", label: "Prête" },
  served: { bg: "bg-violet-100 dark:bg-violet-950", ring: "ring-violet-400", label: "Servie" },
};

export function TablesGrid({ tables, tableStatuses }: Props) {
  if (tables.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune table configurée.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tables.map((t) => {
        const status = tableStatuses[t.id];
        const style = status ? STATUS_STYLES[status] : null;
        const closed = !t.is_open;

        return (
          <div
            key={t.id}
            className={`
              relative flex flex-col items-center justify-center
              h-16 w-16 rounded-xl text-xs font-medium transition-all
              border select-none
              ${closed ? "bg-muted text-muted-foreground opacity-60" : ""}
              ${style ? `${style.bg} ring-2 ${style.ring}` : "bg-card"}
            `}
            title={
              closed
                ? "Fermée"
                : style
                  ? style.label
                  : t.is_occupied
                    ? "Occupée"
                    : "Libre"
            }
          >
            <span className="text-base font-bold leading-tight">{t.table_number}</span>
            {t.label && (
              <span className="text-[9px] text-muted-foreground truncate max-w-[56px] leading-tight">
                {t.label}
              </span>
            )}
            {/* Dot indicateur */}
            {!closed && style && (
              <span
                className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${
                  STATUS_STYLES[status].ring.replace("ring-", "bg-")
                } ring-2 ring-background`}
              />
            )}
            {closed && (
              <span className="text-[9px] text-muted-foreground">Fermée</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
