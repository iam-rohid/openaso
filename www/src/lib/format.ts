// Formatting shared by build-time pages and client scripts.

/** 950 → "950", 1234 → "1.2k", 24000 → "24k". */
export function formatStars(n: number) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
}

export function formatSize(bytes: number) {
  return `${Math.round(bytes / 1_000_000)} MB`;
}
