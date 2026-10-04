export function normalizeMetaDescription(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

export function metaValuesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return normalizeMetaDescription(left) === normalizeMetaDescription(right);
}
