import CyberPanel from "../ui/CyberPanel";
import StructuredValue from "./StructuredValue";

type TechnicalMetadataProps = { result: Record<string, unknown> };
const metadata = [
  ["session_id", "SESSION ID"], ["call_id", "CALL ID"], ["chunk_index", "CHUNK INDEX"],
  ["timestamp", "TIMESTAMP"], ["audio_rule", "AUDIO RULE"], ["session_summary", "SESSION SUMMARY"],
  ["thresholds", "THRESHOLDS"], ["ensemble_weights", "ENSEMBLE WEIGHTS"], ["request", "REQUEST"], ["raw", "RAW DATA"],
] as const;

export default function TechnicalMetadata({ result }: TechnicalMetadataProps) {
  const present = metadata.filter(([key]) => Object.prototype.hasOwnProperty.call(result, key));
  if (!present.length) return null;
  return (
    <CyberPanel title="TECHNICAL METADATA" className="result-panel metadata-panel">
      <dl className="metadata-list">
        {present.map(([key, label]) => (
          <div className="metadata-item" key={key}><dt>{label}</dt><dd><StructuredValue value={result[key]} /></dd></div>
        ))}
      </dl>
    </CyberPanel>
  );
}
