import { useState } from "react";

type AudioDropzoneProps = {
  onSelectFile: (file: File) => void;
  errorMessage: string | null;
};

export default function AudioDropzone({ onSelectFile, errorMessage }: AudioDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const consumeFiles = (files: FileList | null) => {
    const file = files?.item(0);
    if (file) onSelectFile(file);
  };

  return (
    <div>
      <input
        id="audio-file-input"
        className="visually-hidden-input"
        type="file"
        accept=".wav,audio/wav"
        aria-label="Choose a WAV audio file"
        onChange={(event) => {
          consumeFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <label
        htmlFor="audio-file-input"
        className={`audio-dropzone${dragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          consumeFiles(event.dataTransfer.files);
        }}
      >
        <span className="dropzone-path">&gt; INPUT_AUDIO/</span>
        <span className="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none"><path d="M24 32V8m0 0-9 9m9-9 9 9M8 29v10h32V29" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>
        </span>
        <span className="dropzone-title">DROP WAV AUDIO HERE</span>
        <span className="dropzone-hint">OR SELECT A FILE FROM THIS DEVICE</span>
        <span className="cyber-button cyber-button--secondary dropzone-select">SELECT FILE</span>
        <span className="dropzone-format">ACCEPTED FORMAT / .WAV</span>
      </label>
      {errorMessage && <p className="upload-error" role="alert"><strong>{errorMessage.split("\n")[0]}</strong><span>{errorMessage.split("\n")[1]}</span></p>}
    </div>
  );
}
