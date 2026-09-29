import { Link, NavLink, Outlet } from "react-router-dom";

const navigation = [
  { label: "HOME", to: "/", end: true },
  { label: "ANALYZE AUDIO", to: "/analyze", end: false },
  { label: "LIVE MONITOR", to: "/monitor", end: false },
];

export default function AppLayout() {
  return (
    <div className="app-shell scanlines">
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className="site-header">
        <Link className="wordmark" to="/" aria-label="SynthSentinel home">
          <span className="wordmark-mark" aria-hidden="true">SS</span>
          <span>SynthSentinel</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map(({ label, to, end }) => (
            <NavLink
              key={to}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              to={to}
              end={end}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="main-content" id="main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>VOICE FORENSICS / FRONTEND FOUNDATION</span>
        <span>PHASE 01</span>
      </footer>
    </div>
  );
}
