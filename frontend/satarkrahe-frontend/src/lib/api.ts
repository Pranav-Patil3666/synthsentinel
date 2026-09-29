import { getAnalyzeAudioUrl } from "./config";
import type { AnalyzeOutcome, AudioAnalysisResponse, MLInferenceResult } from "../types/analysis";

const CLIENT_TIMEOUT_MS = 130_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isResult(value: unknown): value is MLInferenceResult {
  return isRecord(value);
}

function isSkipped(result: MLInferenceResult): boolean {
  const rawFinal = isRecord(result.raw) && isRecord(result.raw.final) ? result.raw.final : null;
  return result.skip === true || result.skipped === true || result.final?.skipped === true || rawFinal?.skipped === true;
}

function skipReason(result: MLInferenceResult): string {
  const raw = isRecord(result.raw) ? result.raw : undefined;
  const rawReason = typeof raw?.skip_reason === "string" ? raw.skip_reason : undefined;
  return result.skip_reason || rawReason || "skipped";
}

function safeErrorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

/** Performs the only browser request to the Node analysis endpoint. */
export async function analyzeAudio(file: File, options: { signal?: AbortSignal } = {}): Promise<AnalyzeOutcome> {
  if (!(file instanceof File)) return { kind: "error", code: "INVALID_FILE", message: "Select a WAV file before starting analysis." };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  const relayAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) relayAbort();
  else options.signal?.addEventListener("abort", relayAbort, { once: true });

  try {
    const formData = new FormData();
    formData.append("audio", file);
    const response = await fetch(getAnalyzeAudioUrl(), { method: "POST", body: formData, signal: controller.signal });
    let bodyUnknown: unknown;
    try {
      bodyUnknown = await response.json();
    } catch {
      return { kind: "error", code: "MALFORMED_JSON", message: "The backend returned a response that was not valid JSON.", details: `HTTP ${response.status} ${response.statusText}` };
    }
    const body = (isRecord(bodyUnknown) ? bodyUnknown : {}) as AudioAnalysisResponse;
    if (typeof body.error === "string" && /no file uploaded/i.test(body.error)) return { kind: "no_file", message: body.error };
    if (!response.ok) return { kind: "error", code: `HTTP_${response.status}`, message: safeErrorMessage(body, `The backend returned HTTP ${response.status}.`), details: `HTTP ${response.status} ${response.statusText}` };
    if (body.success !== true || !Object.prototype.hasOwnProperty.call(body, "result")) {
      return { kind: "error", code: "UNEXPECTED_RESPONSE", message: "The backend response did not match the analysis contract." };
    }
    if (body.result === null) return { kind: "service_unavailable" };
    if (!isResult(body.result)) return { kind: "error", code: "UNEXPECTED_RESULT", message: "The backend returned an unexpected result shape." };
    const result = body.result;
    if (isSkipped(result)) return { kind: "skipped", result, reason: skipReason(result), body };
    if (!result.final || typeof result.final !== "object") return { kind: "error", code: "MISSING_FINAL", message: "The backend response did not include a final forensic decision." };
    return { kind: "success", result, body };
  } catch {
    if (options.signal?.aborted) return { kind: "error", code: "ABORTED", message: "Analysis request cancelled." };
    if (timedOut) return { kind: "error", code: "TIMEOUT", message: "The analysis request timed out after 130 seconds." };
    return { kind: "error", code: "NETWORK", message: "BACKEND CONNECTION FAILED. Check that the analysis backend is available, then retry." };
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", relayAbort);
  }
}
