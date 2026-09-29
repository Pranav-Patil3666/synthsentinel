import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedAudioFile } from "../types/analysis";

export default function useAudioFile() {
  const [selection, setSelection] = useState<SelectedAudioFile | null>(null);
  const currentUrl = useRef<string | null>(null);

  const clearSelection = useCallback(() => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    setSelection(null);
  }, []);

  const selectFile = useCallback((file: File) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    const objectUrl = URL.createObjectURL(file);
    currentUrl.current = objectUrl;
    setSelection({ file, objectUrl });
  }, []);

  useEffect(() => () => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
  }, []);

  return { selection, selectFile, clearSelection };
}
