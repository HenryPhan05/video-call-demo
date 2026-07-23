import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

const cropSize = 280;
const outputSize = 512;
const minimumZoom = 1;
const maximumZoom = 2;

type Point = {
  x: number;
  y: number;
};

type Dimensions = {
  width: number;
  height: number;
};

type DragState = {
  pointer: Point;
  offset: Point;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const metricsFor = (dimensions: Dimensions, zoom: number) => {
  const baseScale = Math.max(
    cropSize / dimensions.width,
    cropSize / dimensions.height,
  );
  const scale = baseScale * zoom;
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;

  return {
    scale,
    width,
    height,
    maximumX: Math.max(0, (width - cropSize) / 2),
    maximumY: Math.max(0, (height - cropSize) / 2),
  };
};

const constrainOffset = (
  point: Point,
  dimensions: Dimensions,
  zoom: number,
) => {
  const metrics = metricsFor(dimensions, zoom);
  return {
    x: clamp(point.x, -metrics.maximumX, metrics.maximumX),
    y: clamp(point.y, -metrics.maximumY, metrics.maximumY),
  };
};

const canvasBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Unable to crop this image.")),
      type,
      quality,
    );
  });

export function AvatarCropper({
  file,
  onCancel,
  onApply,
}: {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [source, setSource] = useState("");
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSource(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, processing]);

  const metrics = dimensions ? metricsFor(dimensions, zoom) : null;

  const updateZoom = (nextZoom: number) => {
    const normalized = clamp(nextZoom, minimumZoom, maximumZoom);
    setZoom(normalized);
    if (dimensions) {
      setOffset((current) =>
        constrainOffset(current, dimensions, normalized),
      );
    }
  };

  const moveImage = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !dimensions) return;
    setOffset(
      constrainOffset(
        {
          x: drag.offset.x + event.clientX - drag.pointer.x,
          y: drag.offset.y + event.clientY - drag.pointer.y,
        },
        dimensions,
        zoom,
      ),
    );
  };

  const finishDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  };

  const applyCrop = async () => {
    const image = imageRef.current;
    if (!image || !dimensions || !metrics || processing) return;

    setProcessing(true);
    setLoadError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image cropping is not supported.");

      const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      if (outputType === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputSize, outputSize);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const outputScale = outputSize / cropSize;
      const imageX = (cropSize - metrics.width) / 2 + offset.x;
      const imageY = (cropSize - metrics.height) / 2 + offset.y;
      context.drawImage(
        image,
        imageX * outputScale,
        imageY * outputScale,
        metrics.width * outputScale,
        metrics.height * outputScale,
      );

      const blob = await canvasBlob(
        canvas,
        outputType,
        outputType === "image/jpeg" ? 0.92 : undefined,
      );
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      const extension = outputType === "image/jpeg" ? "jpg" : "png";
      onApply(
        new File([blob], `${baseName}-avatar.${extension}`, {
          type: outputType,
          lastModified: Date.now(),
        }),
      );
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Unable to crop this image.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="avatar-cropper-backdrop" role="presentation">
      <section
        className="avatar-cropper"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-cropper-title"
      >
        <header>
          <div>
            <h2 id="avatar-cropper-title">Crop profile photo</h2>
            <p>Drag to reposition, then zoom until it looks right.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            aria-label="Close avatar cropper"
          >
            ×
          </button>
        </header>

        <div
          className={`avatar-crop-viewport ${drag ? "dragging" : ""}`}
          onPointerDown={(event) => {
            if (!dimensions) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDrag({
              pointer: {
                x: event.clientX,
                y: event.clientY,
              },
              offset,
            });
          }}
          onPointerMove={moveImage}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
        >
          {source && (
            <img
              ref={imageRef}
              src={source}
              alt=""
              draggable={false}
              onLoad={(event) => {
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setOffset({
                  x: 0,
                  y: 0,
                });
              }}
              onError={() =>
                setLoadError("This image could not be opened. Choose another.")
              }
              style={
                metrics
                  ? {
                    width: `${metrics.width}px`,
                    height: `${metrics.height}px`,
                    left: `calc(50% + ${offset.x}px)`,
                    top: `calc(50% + ${offset.y}px)`,
                  }
                  : undefined
              }
            />
          )}
          <div className="avatar-crop-guide" aria-hidden="true" />
        </div>

        <div className="avatar-zoom-control">
          <button
            type="button"
            onClick={() => updateZoom(zoom - 0.1)}
            disabled={zoom <= minimumZoom}
            aria-label="Zoom out"
          >
            −
          </button>
          <label>
            <span>Zoom {Math.round(zoom * 100)}%</span>
            <input
              type="range"
              min={minimumZoom}
              max={maximumZoom}
              step="0.01"
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() => updateZoom(zoom + 0.1)}
            disabled={zoom >= maximumZoom}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        {loadError && <p className="avatar-crop-error">{loadError}</p>}

        <footer>
          <button type="button" onClick={onCancel} disabled={processing}>
            Cancel
          </button>
          <button
            className="apply-avatar-crop"
            type="button"
            onClick={() => void applyCrop()}
            disabled={!dimensions || processing || Boolean(loadError)}
          >
            {processing ? "Cropping..." : "Apply photo"}
          </button>
        </footer>
      </section>
    </div>
  );
}
