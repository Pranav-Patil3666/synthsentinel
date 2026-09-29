import type { AnalysisLogEvent, AnalyzeOutcome, MLInferenceResult } from "../../types/analysis";
import { useMemo } from "react";
import CyberButton from "../ui/CyberButton";
import ForensicVerdict from "./ForensicVerdict";
import ForensicSummary from "./ForensicSummary";
import ModelBreakdown from "./ModelBreakdown";
import RiskPanel from "./RiskPanel";
import EnsemblePanel from "./EnsemblePanel";
import RuleAnalysis from "./RuleAnalysis";
import SessionSummary from "./SessionSummary";
import TechnicalMetadata from "./TechnicalMetadata";
import AnalysisTerminal from "./AnalysisTerminal";
import RawResponsePanel from "./RawResponsePanel";
import { ChartThemeProvider } from "../charts/chartTheme";
import { DetectorComparisonChart, LatencyChart, ModelSignatureRadar, ProbabilityDonut, ProbabilityStackChart, RiskLadder, TemporalChart, VoteBreakdown } from "../charts/ChartsCatalog";
import { formatThreshold } from "../../lib/format";

type ReportOutcome = Extract<AnalyzeOutcome, { kind: "success" | "skipped" }>;
type Props = { outcome: ReportOutcome; originalFilename: string; completionTime: Date; events: AnalysisLogEvent[]; onNewAnalysis: () => void };

function resultFor(outcome: ReportOutcome): MLInferenceResult {
  return outcome.result;
}

function audioRuleFor(result: MLInferenceResult) {
  const audioRule = result.audio_rule ?? result.raw?.audio_rule;
  const details = audioRule?.details;
  const rawDuration = result.raw?.duration_sec;
  const duration = details?.duration_sec ?? result.cnn?.meta?.duration_sec ?? (typeof rawDuration === "number" ? rawDuration : null);
  return audioRule && details ? { ...audioRule, details: { ...details, duration_sec: duration } } : audioRule;
}

export default function AnalysisReport({ outcome, originalFilename, completionTime, events, onNewAnalysis }: Props) {
  const skipped = outcome.kind === "skipped";
  const result = resultFor(outcome);
  const audioRule = audioRuleFor(result);
  const sessionSummary = result.session_summary ?? result.raw?.session_summary;
  const rules = result.rules ?? (result.raw?.rules && typeof result.raw.rules === "object" ? result.raw.rules as MLInferenceResult["rules"] : null);
  const normalized: MLInferenceResult = useMemo(() => ({ ...result, audio_rule: audioRule, session_summary: sessionSummary }), [result, audioRule, sessionSummary]);
  const decision = skipped ? result.raw?.final ?? result.final : result.final;
  const backendTime = result.timestamp_utc ?? audioRule?.timestamp_utc ?? result.cnn?.timestamp_utc ?? result.wav2vec2?.timestamp_utc ?? null;
  const logEntries = events.map(({ message, at }) => ({ message, timestamp: at.toLocaleTimeString() }));
  return <section className="forensic-results" aria-labelledby="results-title">
      <div className="results-heading"><div><p className="eyebrow">02 / OUTPUT</p><h2 className="section-title" id="results-title">FORENSIC <span>RESULTS</span></h2></div><CyberButton type="button" variant="secondary" onClick={onNewAnalysis}>NEW ANALYSIS</CyberButton></div>
      <ForensicVerdict decision={decision} filename={originalFilename} analyzedAt={backendTime ?? completionTime.toISOString()} skipped={skipped} />
      {!skipped && result.ensemble?.risk && <RiskPanel risk={result.ensemble.risk} />}
      <ForensicSummary outcome={outcome} />
      {!skipped && <>
        <EnsemblePanel result={normalized} />
        <section className="probability-section" aria-labelledby="probability-heading"><div className="results-subheading"><p className="eyebrow">PROBABILITY VISUALS</p><h3 id="probability-heading">MODEL PROBABILITIES</h3></div>
          <ChartThemeProvider><div className="chart-grid"><ProbabilityDonut result={normalized} /><ProbabilityStackChart result={normalized} /><DetectorComparisonChart result={normalized} /><RiskLadder result={normalized} /></div></ChartThemeProvider>
        </section>
        <ModelBreakdown result={normalized} />
        <section className="comparison-section" aria-labelledby="model-chart-heading"><div className="results-subheading"><p className="eyebrow">MODEL OUTPUTS</p><h3 id="model-chart-heading">COMPARATIVE SIGNALS</h3></div><ChartThemeProvider><div className="chart-grid"><LatencyChart result={normalized} /><ModelSignatureRadar result={normalized} /></div></ChartThemeProvider></section>
      </>}
      {skipped && <ModelBreakdown result={normalized} skipped />}
      <RuleAnalysis result={normalized} skipped={skipped} />
      <section className="temporal-session-section" aria-labelledby="temporal-session-heading"><div className="results-subheading"><p className="eyebrow">TEMPORAL + SESSION</p><h3 id="temporal-session-heading">CHUNK REVIEW</h3></div>
        <ChartThemeProvider><div className="chart-grid"><TemporalChart temporal={rules?.details?.temporal ?? (rules?.temporal?.details && "probs" in rules.temporal.details ? rules.temporal.details as import("../../types/analysis").TemporalDetails : null)} /><VoteBreakdown result={{ ...normalized, rules }} /></div></ChartThemeProvider>
        <SessionSummary summary={sessionSummary} />
      </section>
      <section className="metadata-section" aria-labelledby="metadata-heading"><div className="results-subheading"><p className="eyebrow">THRESHOLDS / VERSIONS / METADATA</p><h3 id="metadata-heading">TECHNICAL REVIEW</h3></div>
        {result.thresholds && <details className="technical-disclosure"><summary>DETECTION THRESHOLDS</summary><dl className="metadata-list"><div className="metadata-item"><dt>CNN THRESHOLD</dt><dd>{formatThreshold(result.thresholds.cnn_fake_threshold)}</dd></div><div className="metadata-item"><dt>WAV2VEC2 THRESHOLD</dt><dd>{formatThreshold(result.thresholds.wav2vec2_fake_threshold)}</dd></div><div className="metadata-item"><dt>MEDIUM RISK BAND</dt><dd>{formatThreshold(result.thresholds.medium_risk_threshold)}</dd></div><div className="metadata-item"><dt>HIGH RISK BAND</dt><dd>{formatThreshold(result.thresholds.high_risk_threshold)}</dd></div></dl></details>}
        {(result.raw?.model_versions || result.cnn?.model_version || result.wav2vec2?.model_version) && <details className="technical-disclosure"><summary>MODEL VERSIONS</summary><dl className="metadata-list"><div className="metadata-item"><dt>CNN</dt><dd>{result.raw?.model_versions?.cnn ?? result.cnn?.model_version ?? "—"}</dd></div><div className="metadata-item"><dt>WAV2VEC2</dt><dd>{result.raw?.model_versions?.wav2vec2 ?? result.wav2vec2?.model_version ?? "—"}</dd></div></dl></details>}
        <TechnicalMetadata result={normalized} originalFilename={originalFilename} />
      </section>
      <AnalysisTerminal entries={logEntries} />
      <RawResponsePanel body={outcome.body} />
  </section>;
}
