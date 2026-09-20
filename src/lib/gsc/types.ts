export type GoogleIdentityRecord = {
  id: string;
  googleSub: string;
  email: string | null;
};

export type GoogleOAuthTokenRecord = {
  id: string;
  googleIdentityId: string;
  encryptionKeyId: string;
  refreshTokenCiphertext: string;
  scopes: string;
  revokedAt: string | null;
};

export type ObserveOwnerRecord = {
  id: string;
  websiteId: string;
  googleIdentityId: string;
  googleOAuthTokenId: string;
  status: "google_connected" | "revoked";
};

export type OwnerSessionRecord = {
  id: string;
  googleIdentityId: string;
  websiteId: string;
  expiresAt: string;
};

export type OAuthStateRecord = {
  id: string;
  state: string;
  websiteId: string;
  returnPath: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type ObserveOwnerView = {
  status: "google_connected";
  email: string | null;
  propertySelected: false;
};

export class OAuthStateError extends Error {
  readonly reason: "missing" | "expired" | "reused";

  constructor(reason: "missing" | "expired" | "reused") {
    super(`OAuth state is ${reason}.`);
    this.name = "OAuthStateError";
    this.reason = reason;
  }
}

export class ObserveAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "ObserveAuthError";
    this.status = status;
  }
}

export class ObserveOwnerConflictError extends Error {
  constructor() {
    super("This site already has a Google account connected.");
    this.name = "ObserveOwnerConflictError";
  }
}
