import { useEffect, useState } from "react";
import type { Attachment } from "../../api/chat";
import { apiClient } from "../../api/client";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function AttachmentMessage({
  attachment,
}: {
 attachment: Attachment
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const isImage = attachment.mimeType.startsWith("image/");
  const isVideo = attachment.mimeType.startsWith("video/");
  const isAudio = attachment.mimeType.startsWith("audio/");
  const isMedia = isImage || isVideo || isAudio;
  const apiPath = attachment.url.replace(/^\/api\/v1/, "");

  useEffect(() => {
    if (!isMedia) return;
    let objectUrl = "";
    let cancelled = false;
    setMediaError("");

    apiClient
      .get<Blob>(apiPath, {
        responseType: "blob",
      })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setMediaUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setMediaError("Preview unavailable");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiPath, isMedia]);

  const download = async () => {
    setDownloading(true);
    setMediaError("");
    try {
      const response = await apiClient.get<Blob>(`${apiPath}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMediaError("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="attachment-message">
        {isImage && mediaUrl && (
          <button
            className="image-preview-button"
            type="button"
            onClick={() => setImageOpen(true)}
            aria-label={`Open ${attachment.originalName}`}
          >
            <img src={mediaUrl} alt={attachment.originalName} />
          </button>
        )}
        {isVideo && mediaUrl && (
          <video src={mediaUrl} controls preload="metadata" />
        )}
        {isAudio && mediaUrl && (
          <>
            <audio src={mediaUrl} controls preload="metadata" />
            {attachment.duration && (
              <small className="voice-duration">
                Voice message · {attachment.duration}s
              </small>
            )}
          </>
        )}
        {isMedia && !mediaUrl && !mediaError && (
          <div className="media-loading">Loading preview...</div>
        )}
        {!isMedia && (
          <div className="document-card">
            <span className="document-icon">
              {attachment.originalName.split(".").pop()?.toUpperCase() ??
                "FILE"}
            </span>
            <span>
              <strong>{attachment.originalName}</strong>
              <small>{formatSize(attachment.size)}</small>
            </span>
          </div>
        )}
        {mediaError && <small className="attachment-error">{mediaError}</small>}
        <button
          className="download-button"
          type="button"
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? "Downloading..." : "Download"}
        </button>
      </div>
      {imageOpen && mediaUrl && (
        <div
          className="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={attachment.originalName}
          onClick={() => setImageOpen(false)}
        >
          <button
            type="button"
            aria-label="Close image"
            onClick={() => setImageOpen(false)}
          >
            Close
          </button>
          <img
            src={mediaUrl}
            alt={attachment.originalName}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
