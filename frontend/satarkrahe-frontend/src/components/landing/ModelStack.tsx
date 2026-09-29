import PageContainer from "../layout/PageContainer";

const stages = [
  { label: "AUDIO", detail: "Uploaded speech input" },
  { label: "CNN", detail: "Acoustic pattern analysis" },
  { label: "WAV2VEC2", detail: "Speech representation analysis" },
  { label: "RULE ENGINE", detail: "Rule-based signal review" },
  { label: "ENSEMBLE", detail: "Evidence fusion" },
  { label: "RISK", detail: "Backend decision output" },
];

export default function ModelStack() {
  return (
    <section className="section-block stack-section" aria-labelledby="stack-title">
      <PageContainer className="stack-content">
        <div className="section-heading-row stack-heading-row">
          <div>
            <p className="eyebrow">02 / SIGNAL ARCHITECTURE</p>
            <h2 className="section-title" id="stack-title">MODEL <span>STACK</span></h2>
          </div>
          <p className="section-aside">CONCEPTUAL PIPELINE / MULTIPLE FORENSIC SIGNALS</p>
        </div>
        <div className="pipeline" aria-label="Audio is analyzed by a CNN, Wav2Vec2, and rule engine, then fused by the ensemble for a risk decision">
          <div className="pipeline-input pipeline-node">
            <span className="pipeline-symbol" aria-hidden="true">◉</span>
            <strong>{stages[0].label}</strong><small>{stages[0].detail}</small>
          </div>
          <span className="pipeline-arrow" aria-hidden="true">↓</span>
          <div className="pipeline-models">
            {stages.slice(1, 4).map((stage) => (
              <div className="pipeline-node" key={stage.label}>
                <span className="pipeline-symbol" aria-hidden="true">＋</span>
                <strong>{stage.label}</strong><small>{stage.detail}</small>
              </div>
            ))}
          </div>
          <span className="pipeline-arrow" aria-hidden="true">↓</span>
          <div className="pipeline-node pipeline-ensemble">
            <span className="pipeline-symbol" aria-hidden="true">⟐</span>
            <strong>{stages[4].label}</strong><small>{stages[4].detail}</small>
          </div>
          <span className="pipeline-arrow" aria-hidden="true">↓</span>
          <div className="pipeline-node pipeline-risk">
            <span className="pipeline-symbol" aria-hidden="true">◇</span>
            <strong>{stages[5].label}</strong><small>{stages[5].detail}</small>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
