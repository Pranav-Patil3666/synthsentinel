export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export function getAnalyzeAudioUrl(): string {
  return `${API_BASE_URL}/api/ml/detect`;
}
