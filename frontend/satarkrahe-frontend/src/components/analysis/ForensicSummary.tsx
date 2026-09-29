import { createForensicSummary } from "../../lib/summary";
import type { AnalyzeOutcome } from "../../types/analysis";
import CyberButton from "../ui/CyberButton";
import CyberPanel from "../ui/CyberPanel";

export default function ForensicSummary({ outcome }: { outcome: AnalyzeOutcome }) {
  const summary = createForensicSummary(outcome);
  const copy = async () => { try { await navigator.clipboard?.writeText(summary); } catch { /* Clipboard access can be unavailable in non-secure contexts. */ } };
  return <CyberPanel title="FORENSIC SUMMARY" eyebrow="PLAIN-LANGUAGE REVIEW" className="result-panel summary-panel">
    <p>{summary}</p>
    <CyberButton type="button" variant="quiet" onClick={copy}>COPY SUMMARY</CyberButton>
  </CyberPanel>;
}
