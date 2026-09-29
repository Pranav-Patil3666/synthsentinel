import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span className="wordmark-mark" aria-hidden="true">SS</span>
        <div>
          <strong>SYNTHSENTINEL</strong>
          <p>Voice forensics for synthetic, spoofed, and manipulated speech.</p>
        </div>
      </div>
      <nav className="footer-nav" aria-label="Footer navigation">
        <Link to="/">HOME</Link>
        <Link to="/analyze">ANALYZE AUDIO</Link>
        <Link to="/monitor">LIVE MONITOR</Link>
      </nav>
      <p className="footer-meta">FORENSIC CONSOLE <span>／</span> SYNTHSENTINEL</p>
    </footer>
  );
}
