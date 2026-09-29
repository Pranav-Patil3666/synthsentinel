import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";

const routeTitles: Record<string, string> = {
  "/": "SynthSentinel — Voice Forensics",
  "/analyze": "Analyze Audio — SynthSentinel",
  "/monitor": "Live Monitor — SynthSentinel",
};

export default function AppLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = routeTitles[pathname] ?? "Not Found — SynthSentinel";
  }, [pathname]);

  return (
    <div className="app-shell scanlines">
      <a className="skip-link" href="#main-content">SKIP TO MAIN CONTENT</a>
      <Navbar />
      <main className="main-content" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
