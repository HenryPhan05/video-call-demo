import type { DragEvent, ReactNode } from 'react';

export function FileDropZone({ disabled = false, onFiles, children }: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  return (
    <div
      onDragOver={(event) => { if (!disabled) event.preventDefault(); }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {children}
    </div>
  );
}
