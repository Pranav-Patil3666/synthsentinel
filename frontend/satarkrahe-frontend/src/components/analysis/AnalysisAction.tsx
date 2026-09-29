import CyberButton from "../ui/CyberButton";

type AnalysisActionProps = {
  canRun: boolean;
  onRunAnalysis: () => void;
};

export default function AnalysisAction({ canRun, onRunAnalysis }: AnalysisActionProps) {
  return (
    <div className="analysis-action">
      <CyberButton type="button" variant="primary" disabled={!canRun} onClick={onRunAnalysis}>
        RUN FORENSIC ANALYSIS <span aria-hidden="true">→</span>
      </CyberButton>
      <p>{canRun ? "INPUT READY / LOCAL FILE SELECTED" : "SELECT A WAV FILE TO ENABLE ANALYSIS"}</p>
    </div>
  );
}
