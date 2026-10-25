import { googleCapabilitiesFromScopes, persistableGrantedScopeString } from "./scopes";

export type GoogleGrantReplacementInput = {
  existingScopes: string | null;
  existingRefreshCiphertext: string | null;
  returnedScopes: string;
  newRefreshCiphertext: string | null;
};

export type GoogleGrantReplacement = {
  scopes: string;
  refreshTokenCiphertext: string;
  retainedExistingRefreshToken: boolean;
  retainedExistingScopes: boolean;
};

export function existingRefreshCiphertextIsUsable(
  ciphertext: string | null | undefined,
): boolean {
  return Boolean(ciphertext) && ciphertext !== "revoked";
}

export function returnedGrantLacksExistingCapabilities(
  existingScopes: string,
  returnedScopes: string,
): boolean {
  const existing = googleCapabilitiesFromScopes(existingScopes);
  const returned = googleCapabilitiesFromScopes(returnedScopes);
  return (
    (existing.canReadSearchConsole && !returned.canReadSearchConsole) ||
    (existing.canWriteSearchConsole && !returned.canWriteSearchConsole) ||
    (existing.canVerifyNewOwnership && !returned.canVerifyNewOwnership)
  );
}

export function resolveGoogleGrantReplacement(
  input: GoogleGrantReplacementInput,
): GoogleGrantReplacement | null {
  const returnedScopes = persistableGrantedScopeString(input.returnedScopes);
  const hasExisting =
    existingRefreshCiphertextIsUsable(input.existingRefreshCiphertext) &&
    Boolean(input.existingScopes);

  if (!hasExisting) {
    if (!input.newRefreshCiphertext) {
      return null;
    }
    return {
      scopes: returnedScopes,
      refreshTokenCiphertext: input.newRefreshCiphertext,
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    };
  }

  const existingScopes = persistableGrantedScopeString(input.existingScopes);
  const existingCiphertext = input.existingRefreshCiphertext as string;

  if (returnedGrantLacksExistingCapabilities(existingScopes, returnedScopes)) {
    return {
      scopes: existingScopes,
      refreshTokenCiphertext: existingCiphertext,
      retainedExistingRefreshToken: true,
      retainedExistingScopes: true,
    };
  }

  if (input.newRefreshCiphertext) {
    return {
      scopes: returnedScopes,
      refreshTokenCiphertext: input.newRefreshCiphertext,
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    };
  }

  return {
    scopes: returnedScopes,
    refreshTokenCiphertext: existingCiphertext,
    retainedExistingRefreshToken: true,
    retainedExistingScopes: false,
  };
}
