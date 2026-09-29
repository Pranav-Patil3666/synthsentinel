import { useState } from "react";
import type { AudioAnalysisResponse } from "../../types/analysis";
import { sanitizedJson } from "../../lib/privacy";
import CyberButton from "../ui/CyberButton";
import CyberPanel from "../ui/CyberPanel";

export default function RawResponsePanel({ body }: { body: AudioAnalysisResponse }) {
  const [open, setOpen] = useState(false);
  const json = sanitizedJson(body);
  const copy = async () => { try { await navigator.clipboard.writeText(json); } catch { /* Clipboard access can be unavailable in non-secure contexts. */ } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "synthsentinel-report.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <CyberPanel title="RAW RESPONSE" eyebrow="SANITIZED DATA" className="result-panel raw-panel">
    <div className="raw-actions"><CyberButton type="button" variant="quiet" onClick={copy}>COPY JSON</CyberButton><CyberButton type="button" variant="quiet" onClick={download}>DOWNLOAD REPORT</CyberButton><CyberButton type="button" variant="quiet" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "HIDE RAW RESPONSE" : "VIEW RAW RESPONSE"}</CyberButton></div>
    {open && <pre className="raw-json" tabIndex={0}>{json}</pre>}
  </CyberPanel>;
}
