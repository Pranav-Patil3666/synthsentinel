import { useState } from "react";
import AudioDropzone from "../components/analysis/AudioDropzone";
import AnalysisAction from "../components/analysis/AnalysisAction";
import AnalysisState from "../components/analysis/AnalysisState";
import ForensicResults from "../components/analysis/ForensicResults";
import SelectedAudioCard from "../components/analysis/SelectedAudioCard";
import CyberPanel from "../components/ui/CyberPanel";
import useAudioFile from "../hooks/useAudioFile";
import type { AudioAnalysisStatus } from "../types/analysis";

export default function AnalyzePage() {
  const { selection, selectFile, clearSelection } = useAudioFile();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineNotice, setPipelineNotice] = useState(false);
  const status: AudioAnalysisStatus = selection ? "FILE_SELECTED" : "IDLE";

  const validateAndSelect = (file: File) => {
    setPipelineNotice(false);
    if (!file) {
      setErrorMessage("NO INPUT DETECTED\nSELECT A WAV FILE TO CONTINUE");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".wav")) {
      setErrorMessage("INVALID FORMAT\nONLY WAV AUDIO IS SUPPORTED");
      return;
    }
    if (file.size === 0) {
      setErrorMessage("NO INPUT DETECTED\nTHE SELECTED FILE IS EMPTY");
      return;
    }
    setErrorMessage(null);
    setPipelineNotice(false);
    selectFile(file);
  };

  const removeSelection = () => {
    clearSelection();
    setErrorMessage(null);
    setPipelineNotice(false);
  };

  const onRunAnalysis = () => {
    if (!selection) return;
    setPipelineNotice(true);
  };

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
          <div className="workspace-heading">
            <h2 id="input-workspace-title"><span className="terminal-prefix">&gt;</span> INPUT_AUDIO/</h2>
            <span className="workspace-code">FORMAT / WAV</span>
          </div>
          <div className={`dropzone-wrapper${selection ? " dropzone-wrapper--collapsed" : ""}`}>
            <AudioDropzone onSelectFile={validateAndSelect} errorMessage={selection ? null : errorMessage} />
          </div>
          {selection && <SelectedAudioCard
            selection={selection}
            onReplace={() => document.getElementById("audio-file-input")?.click()}
            onRemove={removeSelection}
          />}
          {selection && errorMessage && <p className="upload-error" role="alert"><strong>{errorMessage.split("\n")[0]}</strong><span>{errorMessage.split("\n")[1]}</span></p>}
          <AnalysisState status={status} />
          <AnalysisAction canRun={Boolean(selection)} onRunAnalysis={onRunAnalysis} />
          {pipelineNotice && <p className="pipeline-notice" role="status">ANALYSIS PIPELINE NOT CONNECTED</p>}
        </section>

        <aside className="input-side-rail" aria-label="Input notes">
          <CyberPanel title="INPUT SPECIFICATION" eyebrow="LOCAL FILE" className="spec-panel">
            <ul className="spec-list">
              <li><span>ACCEPTED</span><strong>.WAV AUDIO</strong></li>
              <li><span>SELECTION</span><strong>LOCAL DEVICE</strong></li>
              <li><span>ANALYSIS</span><strong>NOT CONNECTED</strong></li>
            </ul>
            <p className="spec-note">File selection and preview run in this browser. No analysis request is sent in this build.</p>
          </CyberPanel>
          <div className="input-rail-decoration" aria-hidden="true"><span /> AUDIO INPUT / WAV <span /></div>
        </aside>
      </div>

      <ForensicResults result={null} />
    </div>
  );
}
