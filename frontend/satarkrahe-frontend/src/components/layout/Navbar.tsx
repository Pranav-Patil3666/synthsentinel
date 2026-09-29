import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const navigation = [
  { label: "HOME", to: "/", end: true },
  { label: "ANALYZE", to: "/analyze", end: false },
  { label: "LIVE MONITOR", to: "/monitor", end: false },
];

export default function Navbar() {
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const menuOpen = openForPath === location.pathname;

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenForPath(null);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link className="wordmark" to="/" aria-label="SynthSentinel home">
        <span className="wordmark-mark" aria-hidden="true">SS</span>
        <span className="wordmark-copy">
          <span className="wordmark-name">SYNTHSENTINEL</span>
          <span className="wordmark-caption">FORENSIC CONSOLE</span>
        </span>
      </Link>

      <button
        ref={toggleRef}
        className="menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setOpenForPath(menuOpen ? null : location.pathname)}
      >
        <span className="menu-toggle-icon" aria-hidden="true"><i /><i /><i /></span>
        <span>{menuOpen ? "CLOSE" : "MENU"}</span>
      </button>

      <nav
        className={`primary-nav${menuOpen ? " is-open" : ""}`}
        id="primary-navigation"
        aria-label="Primary navigation"
      >
        {navigation.map(({ label, to, end }) => (
          <NavLink
            key={to}
            className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            to={to}
            end={end}
            onClick={() => setOpenForPath(null)}
          >
            {label}
          </NavLink>
        ))}
        <Link
          className="cyber-button cyber-button--primary nav-cta"
          to="/analyze"
          onClick={() => setOpenForPath(null)}
        >
          ANALYZE AUDIO <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </header>
  );
}
