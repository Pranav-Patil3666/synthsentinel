import CyberLink from "../ui/CyberLink";

function ForensicHud() {
  return (
    <div className="hero-hud" aria-hidden="true">
      <div className="hud-topline"><span>FORENSIC ENGINE</span><span>INPUT: WAV</span></div>
      <div className="hud-display">
        <div className="hud-grid" />
        <svg className="hud-waveform" viewBox="0 0 600 220" preserveAspectRatio="none">
          <path d="M0 112h46l13-4 12 8 16-24 14 52 17-74 18 46 17-15 15 12h27l14-5 11 9 14-20 16 39 14-54 15 39 16-12h27l13 3 13-8 15 22 14-45 17 61 15-41 17 8h38l13-5 14 8 14-26 14 45 18-62 16 42 15-9h34" />
          <path className="hud-waveform-shadow" d="M0 112h46l13-4 12 8 16-24 14 52 17-74 18 46 17-15 15 12h27l14-5 11 9 14-20 16 39 14-54 15 39 16-12h27l13 3 13-8 15 22 14-45 17 61 15-41 17 8h38l13-5 14 8 14-26 14 45 18-62 16 42 15-9h34" />
        </svg>
        <div className="hud-corner hud-corner--tl" />
        <div className="hud-corner hud-corner--br" />
        <div className="hud-sweep animate-scanline" />
        <div className="hud-center-label">SPECTRAL VIEW</div>
      </div>
      <div className="hud-readouts">
        <span><i className="signal-dot" /> AUDIO INPUT</span>
        <span><i className="signal-line" /> MODEL STACK</span>
        <span><i className="signal-blocks" /> SIGNAL ANALYSIS</span>
      </div>
      <div className="hud-bottomline"><span>VOICE FORENSICS</span><span>INPUT CHANNEL / WAV</span></div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="hero-section page-container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow"><span className="eyebrow-rule" /> VOICE FORENSICS SYSTEM</p>
        <h1 className="hero-title glitch-flicker" id="hero-title">
          <span>SYNTH</span>
          <span>SENTINEL</span>
        </h1>
        <p className="hero-terminal" aria-label="Real-time voice forensics for synthetic, spoofed and manipulated speech">
          <span className="terminal-prefix" aria-hidden="true">&gt;</span>
          <span className="typewriter-line">REAL-TIME VOICE FORENSICS FOR SYNTHETIC, SPOOFED &amp; MANIPULATED SPEECH</span>
          <span className="terminal-cursor animate-blink" aria-hidden="true" />
        </p>
        <p className="hero-description">
          Inspect speech through multiple forensic signals. Analyze an audio file or enter the separate monitoring workspace.
        </p>
        <div className="hero-actions">
          <CyberLink to="/analyze" variant="primary">ANALYZE AUDIO <span aria-hidden="true">→</span></CyberLink>
          <CyberLink to="/monitor" variant="secondary"><span aria-hidden="true">＋</span> OPEN LIVE MONITOR</CyberLink>
        </div>
        <div className="hero-footnote"><span>INPUT FORMAT / WAV</span><span>MODE / FORENSIC REVIEW</span></div>
      </div>
      <ForensicHud />
      <span className="hero-index" aria-hidden="true">SS / VOICE FORENSICS</span>
    </section>
  );
}
