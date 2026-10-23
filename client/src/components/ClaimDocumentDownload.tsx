import { useState } from "react";
import axios from "axios";
import { apiClient } from "../api/client";
import { Button } from "./ui";

interface ClaimDocumentDownloadProps {
  claimId: string;
  documentId: string;
  fileName: string;
  routePrefix: "/api/claims" | "/api/admin/claims";
}

export function ClaimDocumentDownload({
  claimId,
  documentId,
  fileName,
  routePrefix,
}: ClaimDocumentDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function downloadDocument() {
    setIsDownloading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<Blob>(
        `${routePrefix}/${encodeURIComponent(claimId)}/documents/${encodeURIComponent(documentId)}`,
        { responseType: "blob" },
      );
      const objectUrl = window.URL.createObjectURL(response.data);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setErrorMessage(
        axios.isAxiosError(error) && error.response?.status === 404
          ? "This document file is no longer available on the hosting disk."
          : "Unable to download this document. Please try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="grid justify-items-start">
      <Button
        type="button"
        variant="ghost"
        className="text-teal-800"
        disabled={isDownloading}
        onClick={() => void downloadDocument()}
        aria-label={`Download ${fileName}`}
      >
        {isDownloading ? "Downloading…" : "Download"}
      </Button>
      {errorMessage && <p className="text-xs text-rose-700" role="alert">{errorMessage}</p>}
    </div>
  );
}
