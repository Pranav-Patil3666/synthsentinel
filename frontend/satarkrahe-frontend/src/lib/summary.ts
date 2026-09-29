import type { AnalyzeOutcome, MLInferenceResult } from "../types/analysis";
import { formatDuration, formatPercent, formatScore } from "./format";
import { sanitizeText } from "./privacy";

const reasonAliases: Record<string, string> = {
  both_real: "both detectors returned REAL",
  both_fake: "both detectors returned FAKE",
  audio_rule_skip: "audio pre-check rejected this input",
};

export function displayReason(code: string): string {
  const readable = reasonAliases[code];
  return sanitizeText(readable ? `${readable} (${code})` : code);
}

export function createForensicSummary(outcome: AnalyzeOutcome): string {
  if (outcome.kind === "skipped") {
    const raw = outcome.result.raw;
    const rawAudioRule = raw && typeof raw.audio_rule === "object" && raw.audio_rule ? raw.audio_rule as MLInferenceResult["audio_rule"] : undefined;
    const reasons = rawAudioRule?.reasons?.filter(Boolean).map(displayReason) ?? [];
    const rawReason = raw && typeof raw.skip_reason === "string" ? displayReason(raw.skip_reason) : null;
    const allReasons = [...new Set([displayReason(outcome.reason), ...(rawReason ? [rawReason] : []), ...reasons])];
    return sanitizeText(`Analysis was skipped by the backend. Backend reason: ${allReasons.join("; ")}. Generated from the backend response.`);
  }
  if (outcome.kind !== "success") return "A forensic summary is unavailable for this outcome.";
  const { result } = outcome;
  const sentences: string[] = [];
  const final = result.final;
  if (final?.label && final.risk && final.confidence != null) sentences.push(`The backend classified this audio as ${final.label} with ${final.risk} risk (confidence ${formatPercent(final.confidence)}).`);
  const cnn = result.cnn;
  const wav = result.wav2vec2;
  if (cnn?.label && cnn.confidence != null && wav?.label && wav.confidence != null) sentences.push(`CNN returned ${cnn.label} (${formatPercent(cnn.confidence)}) and Wav2Vec2 returned ${wav.label} (${formatPercent(wav.confidence)}).`);
  const sameLabel = result.rules?.details?.consistency?.same_label;
  const agreement = result.ensemble?.agreement_score;
  const disagreement = result.ensemble?.disagreement_score;
  if (sameLabel != null && agreement != null) sentences.push(`The detectors ${sameLabel ? "returned the same label" : "returned different labels"}; the ensemble agreement score is ${formatScore(agreement)}${disagreement == null ? "" : ` and disagreement score is ${formatScore(disagreement)}`}.`);
  else if (agreement != null) sentences.push(`The ensemble agreement score is ${formatScore(agreement)}${disagreement == null ? "" : ` and disagreement score is ${formatScore(disagreement)}`}.`);
  const audio = result.audio_rule?.details ?? result.raw?.audio_rule?.details;
  const rawDuration = result.raw?.duration_sec;
  const duration = audio?.duration_sec ?? result.cnn?.meta?.duration_sec ?? (typeof rawDuration === "number" ? rawDuration : null);
  const silence = audio?.silence_ratio;
  if (duration != null && silence != null) sentences.push(`The clip is ${formatDuration(duration)} with ${formatPercent(silence)} silence.`);
  else if (duration != null) sentences.push(`The clip duration is ${formatDuration(duration)}.`);
  if (result.session_summary?.total_chunks != null) sentences.push(`The upload was analyzed as ${result.session_summary.total_chunks === 1 ? "a single chunk" : `${result.session_summary.total_chunks} chunks`}.`);
  if (sentences.length === 0 && result.rules?.reasons?.length) sentences.push(`The backend reported: ${result.rules.reasons.map(displayReason).join(", ")}.`);
  return `${sentences.slice(0, 4).join(" ")} Generated from the backend response.`;
}
