import { createClient } from "@supabase/supabase-js";

/**
 * Client avec service_role — contourne RLS.
 * À utiliser UNIQUEMENT dans des Server Actions / Route Handlers côté serveur.
 * Ne jamais exposer au navigateur.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
