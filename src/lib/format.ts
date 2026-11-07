const gbp0 = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const gbp2 = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** £1,234 */
export const gbp = (v: number) => gbp0.format(Math.round(v));
/** £3.60 */
export const gbpPence = (v: number) => gbp2.format(v);
/** £1.07M / £153k / £820 */
export function gbpShort(v: number) {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}£${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}£${(a / 1000).toFixed(0)}k`;
  if (a >= 1000) return `${sign}£${(a / 1000).toFixed(1)}k`;
  return `${sign}£${a.toFixed(0)}`;
}
export const n = (v: number) => int.format(v);
export const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2025-07" -> "Jul 25" */
export function monthLabel(m: string) {
  const [y = "", mm = "1"] = m.split("-");
  return `${MONTHS[Number(mm) - 1] ?? ""} ${y.slice(2)}`;
}
