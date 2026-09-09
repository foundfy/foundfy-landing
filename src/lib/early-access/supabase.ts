import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { EarlyAccessSubmission } from "./constants";

type EarlyAccessLeadRow = {
  id: string;
  role: string;
  interest: string;
  website: string | null;
  email: string;
  created_at: string;
};

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
    if (error) {
      console.error("[Early Access] Supabase insert failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    } else {
      console.error("[Early Access] Supabase insert failed: no row returned");
    }

    throw new Error("Failed to save early access lead.");
  }

  return data;
}
