import CyberButton from "../ui/CyberButton";
import type { SelectedAudioFile } from "../../types/analysis";

type SelectedAudioCardProps = {
  selection: SelectedAudioFile;
  onReplace: () => void;
  onRemove: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size)} ${units[unitIndex]}`;
}

export default function SelectedAudioCard({ selection, onReplace, onRemove }: SelectedAudioCardProps) {
  return (
    <section className="selected-audio-card" aria-label="Selected audio file">
      <div className="selected-audio-topline"><span>INPUT SELECTED</span><span className="selected-file-mark" aria-hidden="true">WAV</span></div>
      <div className="selected-file-name" title={selection.file.name}>{selection.file.name}</div>
      <dl className="selected-file-meta">
        <div><dt>FORMAT</dt><dd>WAV AUDIO</dd></div>
        <div><dt>FILE SIZE</dt><dd>{formatFileSize(selection.file.size)}</dd></div>
      </dl>
      <audio className="audio-preview" controls preload="metadata" src={selection.objectUrl} aria-label={`Audio preview: ${selection.file.name}`} />
      <div className="selected-file-actions">
        <CyberButton type="button" variant="secondary" onClick={onReplace}>REPLACE FILE</CyberButton>
        <CyberButton type="button" variant="quiet" onClick={onRemove}>REMOVE FILE</CyberButton>
      </div>
    </section>
  );
}
