import CyberPanel from "../ui/CyberPanel";
import StructuredValue from "./StructuredValue";

type ForensicVerdictProps = { result: Record<string, unknown> };
const fields = [
  ["confidence", "CONFIDENCE"],
  ["fake_prob", "FAKE PROBABILITY"],
  ["real_prob", "REAL PROBABILITY"],
  ["threshold", "THRESHOLD"],
] as const;

export default function ForensicVerdict({ result }: ForensicVerdictProps) {
  const label = result.label;
  const risk = result.risk;
  return (
    <CyberPanel title="FORENSIC VERDICT" eyebrow="FINAL DECISION" className="result-panel verdict-panel">
      <div className="verdict-primary">
        <span className="verdict-label">{label === undefined ? "—" : <StructuredValue value={label} />}</span>
        {risk !== undefined && <span className="verdict-risk-label">RISK / <StructuredValue value={risk} /></span>}
      </div>
      <dl className="verdict-fields">
        {fields.filter(([key]) => result[key] !== undefined).map(([key, title]) => (
          <div key={key}><dt>{title}</dt><dd><StructuredValue value={result[key]} /></dd></div>
        ))}
      </dl>
    </CyberPanel>
  );
}
