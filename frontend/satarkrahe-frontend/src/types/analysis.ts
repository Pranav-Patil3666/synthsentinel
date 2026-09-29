export type AudioAnalysisStatus =
  | "IDLE"
  | "FILE_SELECTED"
  | "PROCESSING"
  | "SUCCESS"
  | "SKIPPED"
  | "ERROR"
  | "SERVICE_UNAVAILABLE";

export type RiskDisplayState = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type SelectedAudioFile = { file: File; objectUrl: string };
export type AnalysisStateProps = { status: AudioAnalysisStatus; skipReason?: string; errorMessage?: string };
export type TerminalEntry = { message: string; timestamp?: string };

export interface FinalDecision {
  label?: string | null;
  confidence?: number | null;
  real_prob?: number | null;
  fake_prob?: number | null;
  risk?: string | null;
  threshold?: number | null;
  skipped?: boolean | null;
  [key: string]: unknown;
}

export interface DetectorMeta {
  sample_rate?: number | null;
  duration_sec?: number | null;
  input_shape?: number[] | null;
  max_length?: number | null;
  pipeline?: string | null;
  threshold?: number | null;
  model_path?: string | null;
  model_dir?: string | null;
  [key: string]: unknown;
}

export interface DetectorResult extends FinalDecision {
  detector?: string | null;
  model_name?: string | null;
  model_version?: string | null;
  sample_rate?: number | null;
  duration_sec?: number | null;
  latency_ms?: number | null;
  timestamp_utc?: string | null;
  chunk_path?: string | null;
  meta?: DetectorMeta | null;
}

export interface AudioRuleDetails {
  duration_sec?: number | null;
  silence_ratio?: number | null;
  silence_threshold?: number | null;
  rms_mean?: number | null;
  rms_std?: number | null;
  clipping_ratio?: number | null;
  dynamic_range_db?: number | null;
  zcr_mean?: number | null;
  flatness_mean?: number | null;
  [key: string]: unknown;
}

export interface AudioRuleResult {
  score?: number | null;
  skip?: boolean | null;
  risk_hint?: string | null;
  votes?: Record<string, number> | null;
  reasons?: string[] | null;
  details?: AudioRuleDetails | null;
  timestamp_utc?: string | null;
  [key: string]: unknown;
}

export interface TemporalDetails {
  window?: number | null;
  probs?: number[] | null;
  labels?: string[] | null;
  high_hits?: number | null;
  medium_hits?: number | null;
  fake_streak?: number | null;
  real_streak?: number | null;
  spike_delta?: number | null;
  flips?: number | null;
  smoothed_fake_prob?: number | null;
  regime_shift?: number | null;
  [key: string]: unknown;
}

export interface ConsistencyDetails {
  gap?: number | null;
  confidence_gap?: number | null;
  same_label?: boolean | null;
  [key: string]: unknown;
}

export interface RuleSubResult {
  score?: number | null;
  skip?: boolean | null;
  risk_hint?: string | null;
  votes?: Record<string, number> | null;
  reasons?: string[] | null;
  details?: AudioRuleDetails | TemporalDetails | ConsistencyDetails | Record<string, unknown> | null;
  timestamp_utc?: string | null;
  [key: string]: unknown;
}

export interface RulesResult {
  rule_score?: number | null;
  risk?: string | null;
  skip?: boolean | null;
  votes?: Record<string, number> | null;
  reasons?: string[] | null;
  details?: {
    audio?: AudioRuleResult | null;
    temporal?: TemporalDetails | null;
    consistency?: ConsistencyDetails | null;
    [key: string]: unknown;
  } | null;
  audio?: RuleSubResult | null;
  temporal?: RuleSubResult | null;
  consistency?: RuleSubResult | null;
  meta?: { weights?: Record<string, number> | null; [key: string]: unknown } | null;
  [key: string]: unknown;
}

export interface EnsembleDetector extends FinalDecision {
  name?: string | null;
  weight?: number | null;
  skip?: boolean | null;
  meta?: DetectorMeta | null;
}

export interface EnsembleMeta {
  weights?: EnsembleWeights | null;
  weighted_fake?: number | null;
  weighted_real?: number | null;
  weighted_threshold?: number | null;
  adjusted_fake?: number | null;
  [key: string]: unknown;
}

export interface EnsembleResult extends FinalDecision {
  cnn?: EnsembleDetector | null;
  wav2vec2?: EnsembleDetector | null;
  rule_score?: number | null;
  rule_votes?: Record<string, number> | null;
  agreement_score?: number | null;
  disagreement_score?: number | null;
  risk_reason?: string | null;
  meta?: EnsembleMeta | null;
  timestamp_utc?: string | null;
}

export interface SessionSummary {
  session_id?: string | null;
  call_id?: string | null;
  total_chunks?: number | null;
  processed_chunks?: number | null;
  skipped_chunks?: number | null;
  real_votes?: number | null;
  fake_votes?: number | null;
  medium_risk_votes?: number | null;
  high_risk_votes?: number | null;
  final_label?: string | null;
  final_risk?: string | null;
  avg_fake_prob?: number | null;
  max_fake_prob?: number | null;
  min_fake_prob?: number | null;
  smoothed_fake_prob?: number | null;
  start_time_utc?: string | null;
  end_time_utc?: string | null;
  duration_sec?: number | null;
  meta?: Record<string, number> | null;
  [key: string]: unknown;
}

export interface Thresholds {
  cnn_fake_threshold?: number | null;
  wav2vec2_fake_threshold?: number | null;
  medium_risk_threshold?: number | null;
  high_risk_threshold?: number | null;
  [key: string]: unknown;
}
export interface EnsembleWeights {
  cnn?: number | null;
  wav2vec2?: number | null;
  rules?: number | null;
  [key: string]: unknown;
}
export interface ModelVersions {
  cnn?: string | null;
  wav2vec2?: string | null;
  [key: string]: unknown;
}
export interface RequestInfo {
  session_id?: string | null;
  call_id?: string | null;
  chunk_index?: number | null;
  filename?: string | null;
  [key: string]: unknown;
}
export interface RawPayload {
  model_versions?: ModelVersions | null;
  final?: FinalDecision | null;
  audio_rule?: AudioRuleResult | null;
  session_summary?: SessionSummary | null;
  sample_rate?: number | null;
  duration_sec?: number | null;
  audio_path?: string | null;
  [key: string]: unknown;
}

export interface MLInferenceResult {
  skip?: boolean | null;
  skipped?: boolean | null;
  skip_reason?: string | null;
  session_id?: string | null;
  call_id?: string | null;
  chunk_index?: number | null;
  final?: FinalDecision | null;
  audio_rule?: AudioRuleResult | null;
  cnn?: DetectorResult | null;
  wav2vec2?: DetectorResult | null;
  rules?: RulesResult | null;
  ensemble?: EnsembleResult | null;
  session_summary?: SessionSummary | null;
  thresholds?: Thresholds | null;
  ensemble_weights?: EnsembleWeights | null;
  request?: RequestInfo | null;
  raw?: RawPayload | null;
  sample_rate?: number | null;
  duration_sec?: number | null;
  timestamp_utc?: string | null;
  [key: string]: unknown;
}

export interface AudioAnalysisResponse {
  success?: boolean;
  result?: MLInferenceResult | null;
  error?: string;
  [key: string]: unknown;
}

export type AnalyzeOutcome =
  | { kind: "success"; result: MLInferenceResult; body: AudioAnalysisResponse }
  | { kind: "skipped"; result: MLInferenceResult; reason: string; body: AudioAnalysisResponse }
  | { kind: "service_unavailable" }
  | { kind: "no_file"; message: string }
  | { kind: "error"; code: string; message: string; details?: string };

export type AnalysisLogEvent = { message: string; at: Date };
