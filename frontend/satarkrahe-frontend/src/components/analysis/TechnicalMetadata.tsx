import type { MLInferenceResult } from "../../types/analysis";
import { displayValue, formatTimestamp } from "../../lib/format";
import { sanitizeText } from "../../lib/privacy";
import CyberPanel from "../ui/CyberPanel";

type Props = { result: MLInferenceResult; originalFilename: string };
export default function TechnicalMetadata({ result, originalFilename }: Props) {
  const model = result.cnn ?? result.wav2vec2;
  const entries: Array<[string, string]> = [
    ["ORIGINAL FILE", sanitizeText(originalFilename)], ["SESSION ID", displayValue(result.session_id)], ["CALL ID", displayValue(result.call_id)], ["CHUNK INDEX", displayValue(result.chunk_index)],
    ["BACKEND TIMESTAMP (LOCAL)", formatTimestamp(result.timestamp_utc ?? result.audio_rule?.timestamp_utc)], ["BACKEND TIMESTAMP (UTC)", displayValue(result.timestamp_utc ?? result.audio_rule?.timestamp_utc)],
    ["STORED AS", sanitizeText(displayValue(result.request?.filename))], ["SAMPLE RATE", displayValue(model?.sample_rate ?? model?.meta?.sample_rate ?? result.raw?.sample_rate)],
    ["INPUT SHAPE", displayValue(model?.meta?.input_shape?.join(" × "))], ["MAX LENGTH", displayValue(model?.meta?.max_length)],
  ];
  return <CyberPanel title="TECHNICAL METADATA" className="result-panel metadata-panel"><dl className="metadata-list">{entries.map(([label, value]) => <div className="metadata-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></CyberPanel>;
}
