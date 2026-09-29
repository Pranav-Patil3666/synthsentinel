import type { FinalDecision } from "../../types/analysis";
import { displayValue, formatPercent, formatThreshold, formatTimestamp } from "../../lib/format";
import CyberPanel from "../ui/CyberPanel";
import { VerdictGauge } from "../charts/ChartsCatalog";
import { ChartThemeProvider } from "../charts/chartTheme";

type ForensicVerdictProps = { decision?: FinalDecision | null; filename: string; analyzedAt?: string | null; skipped?: boolean };
const fields = [
  ["confidence", "CONFIDENCE", formatPercent],
  ["fake_prob", "FAKE PROBABILITY", formatPercent],
  ["real_prob", "REAL PROBABILITY", formatPercent],
  ["threshold", "FUSED DECISION THRESHOLD", formatThreshold],
] as const;

export default function ForensicVerdict({ decision, filename, analyzedAt, skipped = false }: ForensicVerdictProps) {
  const label = skipped ? "UNKNOWN" : displayValue(decision?.label);
  const risk = skipped ? "UNKNOWN" : displayValue(decision?.risk);
  const alertTreatment = label === "FAKE" || risk === "HIGH";
  return <section className={`verdict-hero verdict-hero--${label.toLowerCase()} verdict-hero--risk-${risk.toLowerCase()}${alertTreatment ? " verdict-hero--alert" : ""}`} aria-labelledby="verdict-heading">
    <CyberPanel title="FORENSIC VERDICT" eyebrow="FINAL DECISION" className="result-panel verdict-panel">
      <h3 id="verdict-heading" className="sr-only">Forensic verdict: {label}</h3>
      <div className="verdict-primary"><span className="verdict-label">{label}</span><span className={`verdict-risk-label risk-tag--${risk.toLowerCase()}`}>RISK / {risk} <span aria-hidden="true">{risk === "HIGH" ? "!" : risk === "MEDIUM" ? "△" : risk === "LOW" ? "◇" : "?"}</span></span></div>
      <dl className="verdict-fields">{fields.map(([key, title, format]) => <div key={key}><dt>{title}</dt><dd>{format(decision?.[key])}</dd></div>)}</dl>
      <div className="verdict-file-meta"><span>INPUT / {filename}</span><span>ANALYZED / {formatTimestamp(analyzedAt)}</span></div>
    </CyberPanel>
    {!skipped && decision && <ChartThemeProvider><VerdictGauge result={{ final: decision }} /></ChartThemeProvider>}
  </section>;
}
