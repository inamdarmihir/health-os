import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at top, #161600 0%, #000000 65%)"
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 800,
            color: "#ffd400",
            fontFamily: "sans-serif",
            transform: "translateY(-8px)"
          }}
        >
          H
        </div>
      </div>
    ),
    { ...size }
  );
}
