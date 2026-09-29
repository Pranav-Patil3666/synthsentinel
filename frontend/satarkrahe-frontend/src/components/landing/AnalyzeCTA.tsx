import CyberLink from "../ui/CyberLink";

export default function AnalyzeCTA() {
  return (
    <section className="section-block analyze-cta-section page-container" aria-labelledby="analyze-cta-title">
      <div className="cta-grid-texture" aria-hidden="true" />
      <div className="cta-index">04 / INPUT WORKSPACE</div>
      <div className="cta-copy">
        <p className="eyebrow">WAV INPUT / FORENSIC REVIEW</p>
        <h2 className="section-title" id="analyze-cta-title">BRING THE<br /><span>AUDIO.</span></h2>
        <p>Upload a WAV file to inspect its forensic analysis. The result view is prepared for model evidence and the final decision.</p>
      </div>
      <div className="cta-action-panel">
        <span className="cta-prefix">&gt; INPUT_AUDIO/</span>
        <span className="cta-file-outline" aria-hidden="true"><i /><i /><i /></span>
        <span className="cta-format">SUPPORTED INPUT / WAV</span>
        <CyberLink to="/analyze" variant="primary">ANALYZE AUDIO <span aria-hidden="true">→</span></CyberLink>
      </div>
    </section>
  );
}
