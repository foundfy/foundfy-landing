import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { GOOGLE_OAUTH_SCOPE_STRING } from "./config";
import { OAuthStateError, type GoogleIdentityRecord, type GoogleOAuthTokenRecord, type ObserveOwnerRecord, type OAuthStateRecord, type OwnerSessionRecord } from "./types";

type GoogleIdentityRow = {
  id: string;
  google_sub: string;
  email: string | null;
};

type GoogleOAuthTokenRow = {
  id: string;
  google_identity_id: string;
  encryption_key_id: string;
  refresh_token_ciphertext: string;
  scopes: string;
  revoked_at: string | null;
};

type ObserveOwnerRow = {
  id: string;
  website_id: string;
  google_identity_id: string;
  google_oauth_token_id: string;
  status: "google_connected" | "revoked";
};

type OAuthStateRow = {
  id: string;
  state: string;
  website_id: string;
  return_path: string;
  expires_at: string;
  consumed_at: string | null;
};

type OwnerSessionRow = {
  id: string;
  google_identity_id: string;
  website_id: string;
  expires_at: string;
};

function mapIdentity(row: GoogleIdentityRow): GoogleIdentityRecord {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
  };
}

function mapToken(row: GoogleOAuthTokenRow): GoogleOAuthTokenRecord {
  return {
    id: row.id,
    googleIdentityId: row.google_identity_id,
    encryptionKeyId: row.encryption_key_id,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    scopes: row.scopes,
    revokedAt: row.revoked_at,
  };
}

function mapOwner(row: ObserveOwnerRow): ObserveOwnerRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    googleIdentityId: row.google_identity_id,
    googleOAuthTokenId: row.google_oauth_token_id,
    status: row.status,
  };
}

export async function insertOAuthState(input: {
  state: string;
  websiteId: string;
  returnPath: string;
  expiresAt: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("gsc_oauth_states").insert({
    state: input.state,
    website_id: input.websiteId,
    return_path: input.returnPath,
    expires_at: input.expiresAt,
  });

  if (error) {
    throw new Error(`Failed to store OAuth state: ${error.message}`);
  }
}

export async function consumeOAuthState(
  state: string,
  now = new Date(),
): Promise<OAuthStateRecord> {
  if (!state) {
    throw new OAuthStateError("missing");
  }

  const supabase = getSupabaseAdmin();
  const nowIso = now.toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from("gsc_oauth_states")
    .update({ consumed_at: nowIso })
    .eq("state", state)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("id, state, website_id, return_path, expires_at, consumed_at")
    .maybeSingle();

  if (claimError) {
    throw new Error(`Failed to consume OAuth state: ${claimError.message}`);
  }

  if (claimed) {
    const row = claimed as OAuthStateRow;
    return {
      id: row.id,
      state: row.state,
      websiteId: row.website_id,
      returnPath: row.return_path,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("gsc_oauth_states")
    .select("id, state, website_id, return_path, expires_at, consumed_at")
    .eq("state", state)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to load OAuth state: ${lookupError.message}`);
  }

  if (!existing) {
    throw new OAuthStateError("missing");
  }

  const row = existing as OAuthStateRow;
  if (row.consumed_at) {
    throw new OAuthStateError("reused");
  }

  throw new OAuthStateError("expired");
}

export async function upsertGoogleIdentity(input: {
  googleSub: string;
  email: string | null;
}): Promise<GoogleIdentityRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("google_identities")
    .upsert(
      {
        google_sub: input.googleSub,
        email: input.email,
        updated_at: now,
      },
      { onConflict: "google_sub" },
    )
    .select("id, google_sub, email")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to store Google identity: ${error?.message ?? "unknown error"}`);
  }

  return mapIdentity(data as GoogleIdentityRow);
}

export async function upsertGoogleOAuthToken(input: {
  googleIdentityId: string;
  encryptionKeyId: string;
  refreshTokenCiphertext: string;
  scopes?: string;
}): Promise<GoogleOAuthTokenRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .upsert(
      {
        google_identity_id: input.googleIdentityId,
        encryption_key_id: input.encryptionKeyId,
        refresh_token_ciphertext: input.refreshTokenCiphertext,
        scopes: input.scopes ?? GOOGLE_OAUTH_SCOPE_STRING,
        updated_at: now,
        revoked_at: null,
      },
      { onConflict: "google_identity_id" },
    )
    .select(
      "id, google_identity_id, encryption_key_id, refresh_token_ciphertext, scopes, revoked_at",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to store Google OAuth token: ${error?.message ?? "unknown error"}`);
  }

  return mapToken(data as GoogleOAuthTokenRow);
}

export async function findActiveObserveOwner(
  websiteId: string,
): Promise<ObserveOwnerRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_observe_owners")
    .select("id, website_id, google_identity_id, google_oauth_token_id, status")
    .eq("website_id", websiteId)
    .eq("status", "google_connected")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load observe owner: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapOwner(data as ObserveOwnerRow);
}

export async function insertObserveOwner(input: {
  websiteId: string;
  googleIdentityId: string;
  googleOAuthTokenId: string;
}): Promise<ObserveOwnerRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_observe_owners")
    .insert({
      website_id: input.websiteId,
      google_identity_id: input.googleIdentityId,
      google_oauth_token_id: input.googleOAuthTokenId,
      status: "google_connected",
    })
    .select("id, website_id, google_identity_id, google_oauth_token_id, status")
    .maybeSingle();

  if (error?.code === "23505") {
    const existing = await findActiveObserveOwner(input.websiteId);
    if (existing) {
      return existing;
    }
  }

  if (error || !data) {
    throw new Error(`Failed to reserve observe owner: ${error?.message ?? "unknown error"}`);
  }

  return mapOwner(data as ObserveOwnerRow);
}

export async function countActiveOwnersForIdentity(
  googleIdentityId: string,
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("gsc_observe_owners")
    .select("id", { count: "exact", head: true })
    .eq("google_identity_id", googleIdentityId)
    .eq("status", "google_connected");

  if (error) {
    throw new Error(`Failed to count observe owners: ${error.message}`);
  }

  return count ?? 0;
}

export async function revokeObserveOwner(ownerId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("gsc_observe_owners")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", ownerId)
    .eq("status", "google_connected");

  if (error) {
    throw new Error(`Failed to revoke observe owner: ${error.message}`);
  }
}

export async function disableGoogleOAuthToken(tokenId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("google_oauth_tokens")
    .update({
      refresh_token_ciphertext: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", tokenId);

  if (error) {
    throw new Error(`Failed to disable Google OAuth token: ${error.message}`);
  }
}

export async function findGoogleOAuthTokenById(
  tokenId: string,
): Promise<GoogleOAuthTokenRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select(
      "id, google_identity_id, encryption_key_id, refresh_token_ciphertext, scopes, revoked_at",
    )
    .eq("id", tokenId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google OAuth token: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapToken(data as GoogleOAuthTokenRow);
}

export async function insertOwnerSession(input: {
  tokenHash: string;
  googleIdentityId: string;
  websiteId: string;
  expiresAt: string;
}): Promise<OwnerSessionRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_owner_sessions")
    .insert({
      token_hash: input.tokenHash,
      google_identity_id: input.googleIdentityId,
      website_id: input.websiteId,
      expires_at: input.expiresAt,
    })
    .select("id, google_identity_id, website_id, expires_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to create owner session: ${error?.message ?? "unknown error"}`);
  }

  const row = data as OwnerSessionRow;
  return {
    id: row.id,
    googleIdentityId: row.google_identity_id,
    websiteId: row.website_id,
    expiresAt: row.expires_at,
  };
}

export async function findOwnerSessionByTokenHash(
  tokenHash: string,
  now = new Date(),
): Promise<OwnerSessionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_owner_sessions")
    .select("id, google_identity_id, website_id, expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load owner session: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as OwnerSessionRow;
  return {
    id: row.id,
    googleIdentityId: row.google_identity_id,
    websiteId: row.website_id,
    expiresAt: row.expires_at,
  };
}

export async function revokeOwnerSessionsForWebsiteIdentity(input: {
  websiteId: string;
  googleIdentityId: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("gsc_owner_sessions")
    .update({ revoked_at: now })
    .eq("website_id", input.websiteId)
    .eq("google_identity_id", input.googleIdentityId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(`Failed to revoke owner sessions: ${error.message}`);
  }
}

export async function findGoogleIdentityById(
  identityId: string,
): Promise<GoogleIdentityRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("google_identities")
    .select("id, google_sub, email")
    .eq("id", identityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google identity: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapIdentity(data as GoogleIdentityRow);
}
