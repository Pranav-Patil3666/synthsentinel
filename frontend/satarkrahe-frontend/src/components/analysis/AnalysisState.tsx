import type { AnalysisStateProps } from "../../types/analysis";

const labels = {
  IDLE: ["AWAITING INPUT", "SELECT A WAV FILE TO CONTINUE"],
  FILE_SELECTED: ["FILE READY", "INPUT FILE SELECTED FOR REVIEW"],
  PROCESSING: ["ANALYSIS IN PROGRESS", "FORENSIC PROCESSING IS UNDERWAY"],
  SUCCESS: ["ANALYSIS COMPLETE", "FORENSIC RESULT AVAILABLE"],
  SKIPPED: ["ANALYSIS SKIPPED", "The input could not be processed."],
  ERROR: ["ANALYSIS ERROR", "The analysis could not be completed."],
} as const;

export default function AnalysisState({ status, skipReason, errorMessage }: AnalysisStateProps) {
  const [title, defaultDetail] = labels[status];
  const detail = status === "SKIPPED" ? skipReason : status === "ERROR" ? errorMessage : defaultDetail;

  return (
    <div className={`analysis-state analysis-state--${status.toLowerCase()}`} role={status === "ERROR" ? "alert" : "status"}>
      <span className="analysis-state-mark" aria-hidden="true" />
      <div><strong>{title}</strong><p>{detail || defaultDetail}</p></div>
    </div>
  );
}
