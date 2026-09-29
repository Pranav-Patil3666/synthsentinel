import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeAudio } from "../lib/api";
import { formatFileSize } from "../lib/format";
import { sanitizeText } from "../lib/privacy";
import type { AnalysisLogEvent, AnalyzeOutcome, AudioAnalysisStatus, SelectedAudioFile } from "../types/analysis";

function errorText(outcome: AnalyzeOutcome): string | null {
  if (outcome.kind === "error") return sanitizeText(outcome.message);
  if (outcome.kind === "no_file") return "NO AUDIO INPUT — SELECT A WAV FILE TO CONTINUE.";
  return null;
}

function resultStatus(outcome: AnalyzeOutcome): AudioAnalysisStatus {
  if (outcome.kind === "success") return "SUCCESS";
  if (outcome.kind === "skipped") return "SKIPPED";
  if (outcome.kind === "service_unavailable") return "SERVICE_UNAVAILABLE";
  return "ERROR";
}

export default function useAudioAnalysis() {
  const [selection, setSelection] = useState<SelectedAudioFile | null>(null);
  const [outcome, setOutcome] = useState<AnalyzeOutcome | null>(null);
  const [status, setStatus] = useState<AudioAnalysisStatus>("IDLE");
  const [events, setEvents] = useState<AnalysisLogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const urlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const startedAtRef = useRef<number | null>(null);

  const appendEvent = useCallback((message: string) => setEvents((old) => [...old, { message: sanitizeText(message), at: new Date() }]), []);
  const clear = useCallback((resetSelection: boolean) => {
    requestId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (resetSelection) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setSelection(null);
      setStatus("IDLE");
      setEvents([]);
    } else {
      setStatus(selection ? "FILE_SELECTED" : "IDLE");
    }
    setOutcome(null);
    setCompletedAt(null);
    setError(null);
    setElapsedSeconds(0);
    startedAtRef.current = null;
  }, [selection]);

  const selectFile = useCallback((file: File) => {
    clear(false);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const objectUrl = URL.createObjectURL(file);
    urlRef.current = objectUrl;
    setSelection({ file, objectUrl });
    setStatus("FILE_SELECTED");
    setOutcome(null);
    setCompletedAt(null);
    setError(null);
    setEvents([{ message: `AUDIO INPUT SELECTED — ${sanitizeText(file.name)} (${formatFileSize(file.size)})`, at: new Date() }]);
  }, [clear]);

  const runAnalysis = useCallback(async () => {
    if (!selection || controllerRef.current) return;
    const file = selection.file;
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setOutcome(null);
    setError(null);
    setStatus("PROCESSING");
    const now = new Date();
    setEvents((old) => [...old, { message: "UPLOADING", at: now }, { message: "ANALYSIS REQUEST SENT", at: now }]);
    const response = await analyzeAudio(file, { signal: controller.signal });
    if (currentRequest !== requestId.current) return;
    controllerRef.current = null;
    if (response.kind === "error" && response.code === "ABORTED") {
      setStatus("FILE_SELECTED");
      appendEvent("ANALYSIS REQUEST CANCELLED");
      return;
    }
    setOutcome(response);
    setCompletedAt(new Date());
    setError(errorText(response));
    setStatus(resultStatus(response));
    setEvents((old) => {
      const base = [...old, { message: "RESPONSE RECEIVED", at: new Date() }];
      let line: string;
      if (response.kind === "success") line = "RESULT RECEIVED";
      else if (response.kind === "skipped") line = `ANALYSIS SKIPPED: ${response.reason}`;
      else if (response.kind === "service_unavailable") line = "ML SERVICE UNAVAILABLE";
      else if (response.kind === "no_file") line = `ERROR: ${errorText(response) ?? "NO AUDIO INPUT"}`;
      else line = `ERROR: ${response.message}`;
      base.push({ message: sanitizeText(line), at: new Date() });
      if (response.kind === "success" || response.kind === "skipped") {
        const result = response.result;
        base.push({ message: `REPORT — CNN: ${result.cnn ? "present" : "absent"}; WAV2VEC2: ${result.wav2vec2 ? "present" : "absent"}; RULES: ${result.rules ? "present" : "absent"}; ENSEMBLE: ${result.ensemble ? "present" : "absent"}; SESSION SUMMARY: ${result.session_summary ? "present" : "absent"}`, at: new Date() });
      }
      return base;
    });
  }, [appendEvent, selection]);

  const cancel = useCallback(() => {
    if (status !== "PROCESSING") return;
    controllerRef.current?.abort();
  }, [status]);

  const removeFile = useCallback(() => clear(true), [clear]);

  useEffect(() => {
    if (status !== "PROCESSING") return undefined;
    const timer = window.setInterval(() => {
      if (startedAtRef.current != null) setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    requestId.current += 1;
    controllerRef.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { selection, outcome, status, events, error, elapsedSeconds, completedAt, selectFile, removeFile, newAnalysis: removeFile, runAnalysis, cancel };
}
