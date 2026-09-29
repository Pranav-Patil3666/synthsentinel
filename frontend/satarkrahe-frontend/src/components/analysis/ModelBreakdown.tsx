import type { DetectorResult, MLInferenceResult } from "../../types/analysis";
import { displayValue, formatLatency, formatPercent, formatThreshold } from "../../lib/format";
import CyberPanel from "../ui/CyberPanel";

function DetectorPanel({ title, data, version }: { title: string; data?: DetectorResult | null; version?: string | null }) {
  if (!data) return <CyberPanel title={title} headingLevel={3} className="result-panel model-panel model-panel--empty"><p>NO MODEL OUTPUT</p></CyberPanel>;
  const meta = data.meta;
  const values = [
    ["LABEL", displayValue(data.label)], ["CONFIDENCE", formatPercent(data.confidence)], ["FAKE PROBABILITY", formatPercent(data.fake_prob)], ["REAL PROBABILITY", formatPercent(data.real_prob)],
    [title === "CNN" ? "CNN THRESHOLD" : "WAV2VEC2 THRESHOLD", formatThreshold(data.threshold)], ["RISK", displayValue(data.risk)], ["MODEL", displayValue(data.model_name ?? data.detector)], ["MODEL VERSION", displayValue(version ?? data.model_version)],
    ["SAMPLE RATE", displayValue(data.sample_rate ?? meta?.sample_rate)], ["LATENCY", formatLatency(data.latency_ms)], ["PIPELINE", displayValue(meta?.pipeline)], ["INPUT SHAPE", displayValue(meta?.input_shape?.join(" × "))], ["MAX LENGTH", displayValue(meta?.max_length)],
  ] as const;
  return <CyberPanel title={title} headingLevel={3} className="result-panel model-panel"><dl className="metadata-list">{values.map(([label, value]) => <div className="metadata-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></CyberPanel>;
}

export default function ModelBreakdown({ result, skipped = false }: { result: MLInferenceResult; skipped?: boolean }) {
  const versions = result.raw?.model_versions;
  return <section className="model-breakdown" aria-labelledby="model-breakdown-title">
    <div className="results-subheading"><p className="eyebrow">EVIDENCE CHANNELS</p><h3 id="model-breakdown-title">MODEL COMPARISON</h3></div>
    <div className="model-grid"><DetectorPanel title="CNN" data={skipped ? null : result.cnn} version={versions?.cnn} /><DetectorPanel title="WAV2VEC2" data={skipped ? null : result.wav2vec2} version={versions?.wav2vec2} /></div>
  </section>;
}
