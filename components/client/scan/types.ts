export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  prep_time_minutes: number | null;
  category_id: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  photo_url: string | null;
  quantity: number;
}

export interface TableInfo {
  id: string;
  table_number: number;
  label: string | null;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}
