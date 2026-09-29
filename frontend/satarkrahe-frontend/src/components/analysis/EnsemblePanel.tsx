import type { EnsembleResult, EnsembleWeights, MLInferenceResult } from "../../types/analysis";
import { displayValue, formatPercent, formatScore, formatThreshold } from "../../lib/format";
import { displayReason } from "../../lib/summary";
import CyberPanel from "../ui/CyberPanel";
import { ContributionDonut, FusionTraceChart } from "../charts/ChartsCatalog";
import { ChartThemeProvider } from "../charts/chartTheme";

function weightsFor(result: MLInferenceResult): EnsembleWeights | null {
  if (result.ensemble_weights) return result.ensemble_weights;
  if (result.ensemble?.meta?.weights) return result.ensemble.meta.weights;
  if (result.ensemble?.cnn?.weight != null || result.ensemble?.wav2vec2?.weight != null) return { cnn: result.ensemble.cnn?.weight, wav2vec2: result.ensemble.wav2vec2?.weight };
  return null;
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="metadata-item"><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function EnsemblePanel({ result }: { result: MLInferenceResult }) {
  const ensemble: EnsembleResult | null | undefined = result.ensemble;
  const weights = weightsFor(result);
  if (!ensemble) return null;
  const riskReason = ensemble.risk_reason;
  return <section className="ensemble-section" aria-labelledby="ensemble-title">
    <CyberPanel title="ENSEMBLE DECISION" eyebrow="FUSED BACKEND OUTPUT" className="result-panel ensemble-panel">
      <h3 className="sr-only" id="ensemble-title">Ensemble decision</h3>
      <dl className="metadata-list">
        <Item label="LABEL" value={displayValue(ensemble.label)} />
        <Item label="CONFIDENCE" value={formatPercent(ensemble.confidence)} />
        <Item label="FAKE PROBABILITY" value={formatPercent(ensemble.fake_prob)} />
        <Item label="REAL PROBABILITY" value={formatPercent(ensemble.real_prob)} />
        <Item label="RISK" value={displayValue(ensemble.risk)} />
        <Item label="FUSED DECISION THRESHOLD" value={formatThreshold(result.final?.threshold)} />
        <Item label="AGREEMENT SCORE" value={formatScore(ensemble.agreement_score)} />
        <Item label="DISAGREEMENT SCORE" value={formatScore(ensemble.disagreement_score)} />
        <Item label="RISK REASON" value={riskReason ? displayReason(riskReason) : "—"} />
      </dl>
      {weights && <p className="chart-note">ENSEMBLE WEIGHTS — {Object.entries(weights).map(([name, value]) => `${displayValue(name).toUpperCase()} ${formatPercent(typeof value === "number" ? value : null)}`).join(" / ")}</p>}
    </CyberPanel>
    <ChartThemeProvider><div className="chart-grid"><ContributionDonut result={result} /><FusionTraceChart result={result} /></div></ChartThemeProvider>
  </section>;
}
