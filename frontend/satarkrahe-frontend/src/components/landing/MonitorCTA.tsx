import CyberLink from "../ui/CyberLink";

export default function MonitorCTA() {
  return (
    <section className="section-block monitor-cta-section page-container" aria-labelledby="monitor-cta-title">
      <div>
        <p className="eyebrow">05 / SESSION MODE</p>
        <h2 className="section-title" id="monitor-cta-title">A SEPARATE<br /><span>MONITORING WORKSPACE</span></h2>
        <p>Live monitoring is a distinct product mode for session-aware forensic review. Its real-time connection is not yet connected in this build.</p>
      </div>
      <CyberLink to="/monitor" variant="secondary">OPEN LIVE MONITOR <span aria-hidden="true">↗</span></CyberLink>
    </section>
  );
}
