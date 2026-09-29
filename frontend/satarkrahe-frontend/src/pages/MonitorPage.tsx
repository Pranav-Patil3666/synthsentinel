import CyberLink from "../components/ui/CyberLink";
import CyberPanel from "../components/ui/CyberPanel";

export default function MonitorPage() {
  return (
    <div className="monitor-page page-container">
      <header className="page-intro">
        <p className="breadcrumb"><span>SYNTHSENTINEL</span><i aria-hidden="true">//</i><span>SESSION MODE</span></p>
        <p className="eyebrow">SEPARATE SYSTEM MODE / SESSION-AWARE REVIEW</p>
        <h1 className="section-title analyze-title">LIVE<br /><span>MONITOR</span></h1>
        <p className="page-subtitle">A DEDICATED WORKSPACE FOR REAL-TIME VOICE FORENSICS</p>
      </header>
      <CyberPanel title="MONITORING WORKSPACE" eyebrow="SESSION CONSOLE" className="monitor-shell">
        <div className="monitor-shell-content">
          <span className="monitor-glyph" aria-hidden="true">⌁</span>
          <div>
            <h3>LIVE MONITORING IS NOT YET CONNECTED IN THIS BUILD</h3>
            <p>Live monitoring depends on the telephony pipeline, which is not connected in this build. No live connection or prediction data is available here.</p>
            <CyberLink to="/analyze" variant="secondary">ANALYZE AUDIO <span aria-hidden="true">→</span></CyberLink>
          </div>
        </div>
      </CyberPanel>
    </div>
  );
}
