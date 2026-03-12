import { useCallback, useState } from "react";

import { getClientApiHeaders, readApiErrorMessage } from "@/lib/client/api";

type UseContextUploadParams = {
  onUploaded: (payload: { text: string; fileName: string }) => void;
};

export function useContextUpload({ onUploaded }: UseContextUploadParams) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);

      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: getClientApiHeaders(),
          body: form,
        });

        if (!res.ok) {
          setUploadError(await readApiErrorMessage(res, "Upload failed"));
          return;
        }

        const data = (await res.json()) as { text: string };
        onUploaded({ text: data.text, fileName: file.name });
      } catch {
        setUploadError("Network error - could not upload file");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const resetUploadState = useCallback(() => {
    setUploading(false);
    setUploadError(null);
  }, []);

  return {
    uploading,
    uploadError,
    uploadFile,
    resetUploadState,
    setUploadError,
  };
}
