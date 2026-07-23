import type { DragEvent, ReactNode } from "react";

export function FileDropZone({
  className,
  disabled = false,
  onFiles,
  children,
}: {
  className?: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      onDragOver={(event) => {
        if (!disabled) event.preventDefault();
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {children}
    </div>
  );
}
