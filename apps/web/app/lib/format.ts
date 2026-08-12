export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatCount(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

export function formatUsd(n: number): string {
  if (n < 0.01 && n > 0) return "<$0.01";
  return Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n >= 1 ? 2 : 4 }).format(n);
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function formatDate(iso: string): string {
  try {
    return Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
