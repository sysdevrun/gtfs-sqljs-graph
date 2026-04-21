export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null;
  return withHash.toLowerCase();
}

export function routeBg(color: string | null): string {
  return color ?? '#1f2937';
}

export function routeFg(color: string | null): string {
  return color ?? '#ffffff';
}
