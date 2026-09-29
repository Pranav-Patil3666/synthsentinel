import type { TerminalEntry } from "../../types/analysis";
import CyberPanel from "../ui/CyberPanel";

type AnalysisTerminalProps = { entries?: TerminalEntry[] };

export default function AnalysisTerminal({ entries = [] }: AnalysisTerminalProps) {
  return (
    <CyberPanel title="ANALYSIS TERMINAL" eyebrow="EVENT STREAM" className="result-panel analysis-terminal">
      {entries.length === 0 ? (
        <div className="terminal-empty" aria-live="polite">
          <p><span>&gt;</span> CONSOLE READY<span className="terminal-cursor animate-blink" aria-hidden="true" /></p>
          <p><span>&gt;</span> WAITING FOR AUDIO INPUT</p>
        </div>
      ) : (
        <ol className="terminal-entries" aria-live="polite">
          {entries.map((entry, index) => (
            <li key={`${entry.timestamp ?? "event"}-${index}`}>
              {entry.timestamp && <time>{entry.timestamp}</time>}<span className="process-prompt">&gt;</span>{entry.message}
            </li>
          ))}
        </ol>
      )}
    </CyberPanel>
  );
}
