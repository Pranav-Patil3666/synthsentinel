import type { UiResultState } from "../../types/analysis";
import AnalysisTerminal from "./AnalysisTerminal";
import ForensicVerdict from "./ForensicVerdict";
import ModelBreakdown from "./ModelBreakdown";
import RiskPanel from "./RiskPanel";
import TechnicalMetadata from "./TechnicalMetadata";

export default function ForensicResults({ result }: UiResultState) {
  if (!result) {
    return (
      <section className="forensic-results" aria-labelledby="results-title">
        <div className="results-heading"><div><p className="eyebrow">02 / OUTPUT</p><h2 className="section-title" id="results-title">FORENSIC <span>RESULTS</span></h2></div><span className="results-code">RESULT SCHEMA / READY</span></div>
        <div className="results-empty" role="status">
          <span className="empty-crosshair" aria-hidden="true">＋</span>
          <strong>AWAITING ANALYSIS</strong>
          <p>NO FORENSIC RESULT AVAILABLE</p>
        </div>
        <AnalysisTerminal />
      </section>
    );
  }

  return (
    <section className="forensic-results" aria-labelledby="results-title">
      <div className="results-heading"><div><p className="eyebrow">02 / OUTPUT</p><h2 className="section-title" id="results-title">FORENSIC <span>RESULTS</span></h2></div><span className="results-code">RESULT SCHEMA / READY</span></div>
      <div className="verdict-grid">
        <ForensicVerdict result={result} />
        {result.risk !== undefined && <RiskPanel risk={result.risk} />}
      </div>
      <ModelBreakdown
        cnn={result.cnn}
        wav2vec2={result.wav2vec2}
        rules={result.rules}
        ensemble={result.ensemble}
      />
      <TechnicalMetadata result={result} />
      <AnalysisTerminal />
    </section>
  );
}
