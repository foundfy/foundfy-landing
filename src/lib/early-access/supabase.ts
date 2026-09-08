import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EarlyAccessSubmission } from "./constants";

type EarlyAccessLeadRow = {
  id: string;
  role: string;
  interest: string;
  website: string | null;
  email: string;
  created_at: string;
};

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase configuration is missing.");
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

export async function insertEarlyAccessLead(
  submission: EarlyAccessSubmission,
): Promise<EarlyAccessLeadRow> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("early_access_leads")
    .insert({
      role: submission.role,
      interest: submission.interest,
      website: submission.website,
      email: submission.email,
    })
    .select("id, role, interest, website, email, created_at")
    .single();

  if (error || !data) {
    throw new Error("Failed to save early access lead.");
  }

  return data;
}
