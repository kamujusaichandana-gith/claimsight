import { useRef, useState } from "react";
import { formatFileSize } from "./document-validation";

export function DocumentsStep({
  files,
  errors,
  onAddFiles,
  onRemoveFile,
}: {
  files: File[];
  errors: string[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (index: number) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openPicker() {
    fileInput.current?.click();
  }

  return (
    <div className="grid gap-4">
      <label htmlFor="supporting-documents" id="upload-label" className="text-sm font-medium text-slate-700">
        Supporting documents (optional)
      </label>
      <input
        ref={fileInput}
        id="supporting-documents"
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        multiple
        aria-labelledby="upload-label"
        aria-invalid={errors.length > 0}
        aria-describedby={`upload-instructions${errors.length > 0 ? " upload-errors" : ""}`}
        onChange={(event) => {
          if (event.currentTarget.files) onAddFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-describedby={`upload-instructions${errors.length > 0 ? " upload-errors" : ""}`}
        aria-invalid={errors.length > 0}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onAddFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${
          isDragging ? "border-teal-700 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-teal-500"
        }`}
      >
        <span className="text-sm font-semibold text-slate-900">Drop files here or choose files</span>
        <span className="mt-1 text-sm text-slate-500">PDF, JPG, or PNG · up to 5 MB per file</span>
      </button>
      <p id="upload-instructions" className="text-sm text-slate-600">
        PDF, JPG, or PNG, up to 5 MB per file. You can add documents later from your claim.
      </p>
      {errors.length > 0 && (
        <ul id="upload-errors" className="grid gap-1 text-sm text-rose-700" role="alert">
          {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Selected documents">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{file.name}</span>
                <span className="block text-xs text-slate-500">{formatFileSize(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
