import { lazy, Suspense, useState } from "react";
import AudioDropzone from "../components/analysis/AudioDropzone";
import AnalysisState from "../components/analysis/AnalysisState";
import AnalysisTerminal from "../components/analysis/AnalysisTerminal";
import SelectedAudioCard from "../components/analysis/SelectedAudioCard";
import CyberButton from "../components/ui/CyberButton";
import CyberPanel from "../components/ui/CyberPanel";
import useAudioAnalysis from "../hooks/useAudioAnalysis";
import { sanitizeText } from "../lib/privacy";

const AnalysisReport = lazy(() => import("../components/analysis/AnalysisReport"));

export default function AnalyzePage() {
  const analysis = useAudioAnalysis();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const { selection, status, outcome, error, elapsedSeconds, completedAt } = analysis;

  const validateAndSelect = (file: File) => {
    setSelectionError(null);
    if (!file.name.toLowerCase().endsWith(".wav")) {
      analysis.removeFile();
      setSelectionError("INVALID FORMAT — ONLY WAV AUDIO IS SUPPORTED.");
      return;
    }
    if (file.size === 0) {
      analysis.removeFile();
      setSelectionError("NO INPUT DETECTED — THE SELECTED FILE IS EMPTY.");
      return;
    }
    analysis.selectFile(file);
  };

  const reportOutcome = outcome && (outcome.kind === "success" || outcome.kind === "skipped") ? outcome : null;
  const isReport = reportOutcome !== null;
  const canRetry = selection && (status === "ERROR" || status === "SERVICE_UNAVAILABLE");
  return (
    <div className="analyze-page page-container">
      <header className="page-intro">
        <p className="breadcrumb"><span>SYNTHSENTINEL</span><i aria-hidden="true">//</i><span>FORENSIC ANALYSIS</span><i aria-hidden="true">//</i><span>INPUT</span></p>
        <p className="eyebrow">01 / AUDIO INPUT</p>
        <h1 className="section-title analyze-title">AUDIO FORENSIC<br /><span>ANALYSIS</span></h1>
        <p className="page-subtitle">UPLOAD A WAV FILE TO BEGIN ANALYSIS</p>
      </header>

      <div className="analysis-workspace">
        <section className="input-workspace" aria-labelledby="input-workspace-title">
          <div className="workspace-heading"><h2 id="input-workspace-title"><span className="terminal-prefix">&gt;</span> INPUT_AUDIO/</h2><span className="workspace-code">FORMAT / WAV</span></div>
          <div className={`dropzone-wrapper${selection ? " dropzone-wrapper--collapsed" : ""}`}><AudioDropzone onSelectFile={validateAndSelect} errorMessage={selection ? null : selectionError} /></div>
          {selection && <SelectedAudioCard selection={selection} onReplace={() => document.getElementById("audio-file-input")?.click()} onRemove={() => { analysis.removeFile(); setSelectionError(null); }} />}
          {selectionError && selection && <p className="upload-error" role="alert">{selectionError}</p>}
          <AnalysisState status={status} skipReason={outcome?.kind === "skipped" ? sanitizeText(outcome.reason) : undefined} errorMessage={error ?? undefined} />

          {status === "PROCESSING" ? (
            <div className="processing-panel" role="status" aria-live="polite"><strong>RUNNING FORENSIC ANALYSIS</strong><span className="scan-bar" aria-hidden="true" /><span>ELAPSED / {elapsedSeconds}s</span><p>Long files can take a while to analyze.</p><CyberButton type="button" variant="quiet" onClick={analysis.cancel}>CANCEL</CyberButton></div>
          ) : (
            <div className="analysis-action">
              <CyberButton type="button" variant="primary" disabled={!selection} onClick={() => void analysis.runAnalysis()}>{canRetry ? "RETRY ANALYSIS" : "RUN FORENSIC ANALYSIS"} <span aria-hidden="true">→</span></CyberButton>
              <p>{selection ? "INPUT READY / ANALYSIS SENT TO BACKEND" : "SELECT A WAV FILE TO ENABLE ANALYSIS"}</p>
            </div>
          )}
          {status === "ERROR" && outcome?.kind === "error" && <details className="technical-disclosure error-details"><summary>TECHNICAL DETAILS</summary><dl className="metadata-list"><div className="metadata-item"><dt>ERROR CODE</dt><dd>{sanitizeText(outcome.code)}</dd></div><div className="metadata-item"><dt>DETAILS</dt><dd>{sanitizeText(outcome.details ?? outcome.message)}</dd></div></dl></details>}
          {status === "SERVICE_UNAVAILABLE" && <p className="service-note" role="status">The backend accepted the file but no inference result was returned.</p>}
          {outcome?.kind === "no_file" && <p className="upload-error" role="alert">NO AUDIO INPUT — SELECT A WAV FILE TO CONTINUE.</p>}
          {outcome && !isReport && <AnalysisTerminal entries={analysis.events.map(({ message, at }) => ({ message, timestamp: at.toLocaleTimeString() }))} />}
        </section>

        <aside className="input-side-rail" aria-label="Input notes">
          <CyberPanel title="INPUT SPECIFICATION" eyebrow="LOCAL FILE" className="spec-panel"><ul className="spec-list"><li><span>ACCEPTED</span><strong>.WAV AUDIO</strong></li><li><span>SELECTION</span><strong>LOCAL DEVICE</strong></li><li><span>ANALYSIS</span><strong>NODE BACKEND</strong></li></ul><p className="spec-note">The selected audio is uploaded for server-side forensic analysis. No telephony or live monitoring data is used.</p></CyberPanel>
          <div className="input-rail-decoration" aria-hidden="true"><span /> AUDIO INPUT / WAV <span /></div>
        </aside>
      </div>

      {reportOutcome && selection && completedAt && <Suspense fallback={<div className="report-skeleton" role="status">LOADING FORENSIC REPORT…</div>}><AnalysisReport key={selection.file.name} outcome={reportOutcome} originalFilename={selection.file.name} completionTime={completedAt} events={analysis.events} onNewAnalysis={analysis.newAnalysis} /></Suspense>}
    </div>
  );
}
