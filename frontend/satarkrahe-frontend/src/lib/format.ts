import { sanitizeText } from "./privacy";

export const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  return sanitizeText(String(value));
};
export const formatPercent = (value: number | null | undefined): string => value == null ? "—" : `${(value * 100).toFixed(2)}%`;
export const formatThreshold = (value: number | null | undefined): string => value == null ? "—" : value.toFixed(3);
export const formatScore = (value: number | null | undefined): string => value == null ? "—" : value.toFixed(4);
export const formatLatency = (value: number | null | undefined): string => value == null ? "—" : `${value.toFixed(2)} ms`;
export const formatRatioPercent = formatPercent;
export const formatDb = (value: number | null | undefined): string => value == null ? "—" : `${value.toFixed(2)} dB`;
export const formatDuration = (value: number | null | undefined): string => value == null ? "—" : `${value.toFixed(3)} s`;

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? sanitizeText(value) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
