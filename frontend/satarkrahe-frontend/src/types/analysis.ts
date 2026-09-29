export type AudioAnalysisStatus =
  | "IDLE"
  | "FILE_SELECTED"
  | "PROCESSING"
  | "SUCCESS"
  | "SKIPPED"
  | "ERROR";

export type RiskDisplayState = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type SelectedAudioFile = {
  file: File;
  objectUrl: string;
};

export type UiResultState = {
  result: Record<string, unknown> | null;
};

export type AnalysisStateProps = {
  status: AudioAnalysisStatus;
  skipReason?: string;
  errorMessage?: string;
};

export type TerminalEntry = {
  message: string;
  timestamp?: string;
};
