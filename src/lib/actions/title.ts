export function normalizeTitle(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function titleValuesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return normalizeTitle(left) === normalizeTitle(right);
}
