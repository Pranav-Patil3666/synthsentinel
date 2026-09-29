import type { SessionSummary as SessionSummaryData } from "../../types/analysis";
import { displayValue, formatDuration, formatPercent, formatTimestamp } from "../../lib/format";
import CyberPanel from "../ui/CyberPanel";

type Props = { summary?: SessionSummaryData | null };
const metrics = [
  ["TOTAL CHUNKS", (d: SessionSummaryData) => displayValue(d.total_chunks)],
  ["PROCESSED CHUNKS", (d: SessionSummaryData) => displayValue(d.processed_chunks)],
  ["SKIPPED CHUNKS", (d: SessionSummaryData) => displayValue(d.skipped_chunks)],
  ["REAL VOTES", (d: SessionSummaryData) => displayValue(d.real_votes)],
  ["FAKE VOTES", (d: SessionSummaryData) => displayValue(d.fake_votes)],
  ["MEDIUM RISK VOTES", (d: SessionSummaryData) => displayValue(d.medium_risk_votes)],
  ["HIGH RISK VOTES", (d: SessionSummaryData) => displayValue(d.high_risk_votes)],
  ["FINAL LABEL", (d: SessionSummaryData) => displayValue(d.final_label)],
  ["FINAL RISK", (d: SessionSummaryData) => displayValue(d.final_risk)],
  ["AVERAGE FAKE PROBABILITY", (d: SessionSummaryData) => formatPercent(d.avg_fake_prob)],
  ["MAX FAKE PROBABILITY", (d: SessionSummaryData) => formatPercent(d.max_fake_prob)],
  ["MIN FAKE PROBABILITY", (d: SessionSummaryData) => formatPercent(d.min_fake_prob)],
  ["SMOOTHED FAKE PROBABILITY", (d: SessionSummaryData) => formatPercent(d.smoothed_fake_prob)],
  ["START TIME", (d: SessionSummaryData) => formatTimestamp(d.start_time_utc)],
  ["END TIME", (d: SessionSummaryData) => formatTimestamp(d.end_time_utc)],
  ["DURATION", (d: SessionSummaryData) => formatDuration(d.duration_sec)],
] as const;

export default function SessionSummary({ summary }: Props) {
  if (!summary) return null;
  return <CyberPanel title="SESSION SUMMARY" eyebrow="UPLOAD REVIEW" className="result-panel session-panel">
    <p className="chart-note">THIS UPLOAD IS ANALYZED AS A SINGLE CHUNK.</p>
    <dl className="metadata-list">{metrics.map(([label, getValue]) => <div className="metadata-item" key={label}><dt>{label}</dt><dd>{getValue(summary)}</dd></div>)}</dl>
  </CyberPanel>;
}
