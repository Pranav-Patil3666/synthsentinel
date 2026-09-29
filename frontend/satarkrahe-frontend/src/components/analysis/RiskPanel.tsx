import type { RiskDisplayState } from "../../types/analysis";
import CyberPanel from "../ui/CyberPanel";

type RiskPanelProps = { risk: unknown };
const riskValues: RiskDisplayState[] = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"];

export default function RiskPanel({ risk }: RiskPanelProps) {
  const normalized = typeof risk === "string" && riskValues.includes(risk.toUpperCase() as RiskDisplayState)
    ? risk.toUpperCase() as RiskDisplayState
    : "UNKNOWN";

  return (
    <CyberPanel title="BACKEND RISK" className={`result-panel risk-panel risk-${normalized.toLowerCase()}`}>
      <div className="risk-display">
        <span className="risk-symbol" aria-hidden="true">{normalized === "LOW" ? "◇" : normalized === "MEDIUM" ? "△" : normalized === "HIGH" ? "!" : "?"}</span>
        <strong>{normalized}</strong>
      </div>
    </CyberPanel>
  );
}
