import type { MLInferenceResult, RuleSubResult } from "../../types/analysis";
import { displayValue, formatScore } from "../../lib/format";
import { displayReason } from "../../lib/summary";
import CyberPanel from "../ui/CyberPanel";
import { AudioDiagnosticsChart, AgreementBars, RuleScoreChart } from "../charts/ChartsCatalog";
import { ChartThemeProvider } from "../charts/chartTheme";

function reasonsList(reasons?: string[] | null) {
  if (!reasons?.length) return <span>—</span>;
  return <ul className="reason-list">{reasons.map((reason, i) => <li key={`${reason}-${i}`}>{displayReason(reason)}</li>)}</ul>;
}

function RuleSubpanel({ name, item }: { name: string; item?: RuleSubResult | null }) {
  if (!item) return null;
  return <article className="rule-subpanel"><h4>{name}</h4><dl className="metadata-list"><div className="metadata-item"><dt>SCORE</dt><dd>{formatScore(item.score)}</dd></div><div className="metadata-item"><dt>RISK HINT</dt><dd>{displayValue(item.risk_hint)}</dd></div><div className="metadata-item"><dt>REASONS</dt><dd>{reasonsList(item.reasons)}</dd></div></dl></article>;
}

export default function RuleAnalysis({ result, skipped = false }: { result: MLInferenceResult; skipped?: boolean }) {
  const rules = result.rules ?? (result.raw?.rules && typeof result.raw.rules === "object" ? result.raw.rules as MLInferenceResult["rules"] : null);
  const audioRule = result.audio_rule ?? result.raw?.audio_rule;
  return <section className="rule-analysis" aria-labelledby="rule-analysis-title">
    <div className="results-subheading"><p className="eyebrow">RULE ENGINE + AUDIO DIAGNOSTICS</p><h3 id="rule-analysis-title">RULE ANALYSIS</h3></div>
    {rules && <CyberPanel title="RULE ENGINE" className="result-panel rule-panel"><dl className="metadata-list"><div className="metadata-item"><dt>RULE SCORE</dt><dd>{formatScore(rules.rule_score)}</dd></div><div className="metadata-item"><dt>RISK</dt><dd>{displayValue(rules.risk)}</dd></div><div className="metadata-item"><dt>REASONS</dt><dd>{reasonsList(rules.reasons)}</dd></div></dl><div className="rule-subgrid"><RuleSubpanel name="AUDIO" item={rules.audio} /><RuleSubpanel name="TEMPORAL" item={rules.temporal} /><RuleSubpanel name="CONSISTENCY" item={rules.consistency} /></div></CyberPanel>}
    {skipped && !rules && <p className="chart-note">The backend returned skipped audio diagnostics; detector output is not available.</p>}
    <ChartThemeProvider><div className="chart-grid"><RuleScoreChart result={{ ...result, rules }} /><AudioDiagnosticsChart details={audioRule?.details} /><AgreementBars result={{ ...result, rules }} /></div></ChartThemeProvider>
  </section>;
}
