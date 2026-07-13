"use client";

import { useRef } from "react";
import type { ImageInput, ImageKind } from "../lib/health-types";

const LABELS: Record<ImageKind, string> = {
  face: "Face",
  frontBody: "Front body",
  sideBody: "Side body",
  posture: "Posture (side-standing)"
};

type Props = {
  kind: ImageKind;
  image: ImageInput | null;
  onCapture: (image: ImageInput) => void;
  onClear: () => void;
};

export function CaptureSlot({ kind, image, onCapture, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    onCapture({ kind, mimeType: file.type || "image/jpeg", data: btoa(binary) });
  }

  return (
    <div>
      <div
        className="capture-slot"
        onClick={() => {
          if (image) return;
          inputRef.current?.click();
        }}
      >
        {image ? (
          <img src={`data:${image.mimeType};base64,${image.data}`} alt={LABELS[kind]} />
        ) : (
          <span className="hint">Tap to capture or upload {LABELS[kind].toLowerCase()}</span>
        )}
        <span className="label">{LABELS[kind]}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
      {image && (
        <button type="button" className="secondary" style={{ marginTop: 8, width: "100%" }} onClick={onClear}>
          Retake {LABELS[kind]}
        </button>
      )}
    </div>
  );
}
