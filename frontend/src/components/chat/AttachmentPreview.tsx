import { useEffect, useState } from "react";

export function AttachmentPreview({
  file,
}: {
 file: File
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="attachment-preview">
      {file.type.startsWith("image/") && <img src={url} alt={file.name} />}
      {file.type.startsWith("video/") && <video src={url} controls />}
      {file.type.startsWith("audio/") && <audio src={url} controls />}
      {!/^(image|video|audio)\//.test(file.type) && (
        <span className="file-icon">📄</span>
      )}
      <span>
        <strong>{file.name}</strong>
        <small>{Math.ceil(file.size / 1024)} KB</small>
      </span>
    </div>
  );
}
