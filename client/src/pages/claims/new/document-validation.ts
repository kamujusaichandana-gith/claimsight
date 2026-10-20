const MAX_FILE_SIZE = 5 * 1024 * 1024;
const supportedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isSupportedDocument(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedExtension = extension === "pdf" || extension === "jpg" || extension === "jpeg" || extension === "png";
  return supportedTypes.has(file.type) && supportedExtension && file.size <= MAX_FILE_SIZE;
}

export function documentError(file: File): string | undefined {
  if (file.size > MAX_FILE_SIZE) return `${file.name}: Files must be 5 MB or smaller.`;
  if (!isSupportedDocument(file)) return `${file.name}: Choose a PDF, JPG, or PNG file.`;
  return undefined;
}
