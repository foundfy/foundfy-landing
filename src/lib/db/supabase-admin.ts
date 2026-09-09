import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

function getMissingSupabaseEnvVars(): string[] {
  const missing: string[] = [];

  if (!process.env.SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    throw new Error(`Supabase configuration is missing: ${missing.join(", ")}`);
  }

  supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return supabaseAdmin;
}

export function assertSupabaseConfigured(): void {
  const missing = getMissingSupabaseEnvVars();
  if (missing.length > 0) {
    throw new Error(`Supabase configuration is missing: ${missing.join(", ")}`);
  }
}
