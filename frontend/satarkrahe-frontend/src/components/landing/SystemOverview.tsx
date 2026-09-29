const capabilities = [
  { index: "A", title: "AUDIO FORENSICS", text: "Examine acoustic structure and speech signals for signs of synthetic or manipulated audio." },
  { index: "B", title: "SPOOF DETECTION", text: "Use complementary model and rule-based analysis to assess suspicious speech." },
  { index: "C", title: "ENSEMBLE DECISIONING", text: "Combine available forensic signals into a final decision with its supporting evidence." },
  { index: "D", title: "SESSION-AWARE MONITORING", text: "A separate monitoring mode is designed to organize analysis across a live session." },
];

export default function SystemOverview() {
  return (
    <section className="section-block overview-section page-container" aria-labelledby="overview-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">01 / CAPABILITIES</p>
          <h2 className="section-title" id="overview-title">WHAT IT <span>DOES</span></h2>
        </div>
        <p className="section-aside">A FORENSIC WORKFLOW BUILT TO EXAMINE SPEECH FROM MORE THAN ONE ANGLE.</p>
      </div>
      <div className="capability-grid">
        {capabilities.map((item) => (
          <article className="capability-card" key={item.index}>
            <span className="card-index">{item.index} / SIGNAL</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <span className="card-trace" aria-hidden="true" />
          </article>
        ))}
      </div>
    </section>
  );
}
