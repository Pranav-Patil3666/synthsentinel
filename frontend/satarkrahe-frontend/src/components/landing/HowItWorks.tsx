const steps = [
  "INPUT AUDIO",
  "SIGNAL PREPROCESSING",
  "FEATURE EXTRACTION",
  "MODEL INFERENCE",
  "RULE ANALYSIS",
  "ENSEMBLE FUSION",
  "RISK DECISION",
];

export default function HowItWorks() {
  return (
    <section className="section-block process-section page-container" aria-labelledby="process-title">
      <div className="process-intro">
        <p className="eyebrow">03 / PROCESS SEQUENCE</p>
        <h2 className="section-title" id="process-title">FROM INPUT<br /><span>TO EVIDENCE</span></h2>
        <p>Each stage contributes a different view of the audio. The interface will expose the returned evidence when analysis is connected.</p>
      </div>
      <div className="process-terminal" aria-label="Conceptual audio analysis process">
        <div className="terminal-bar"><span>PROCESS / FORENSIC REVIEW</span><span>SEQUENCE</span></div>
        <ol>
          {steps.map((step, index) => (
            <li key={step}><span className="process-prompt">&gt;</span><span>{step}</span>{index === steps.length - 1 && <span className="terminal-cursor animate-blink" aria-hidden="true" />}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
