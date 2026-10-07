import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 42,
          background: "linear-gradient(135deg, #E8A0BF 0%, #B79CED 54%, #8FA8E8 100%)",
          boxShadow: "inset 0 0 0 8px rgba(255,255,255,0.18)",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "60%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            background: "rgba(255,255,255,0.12)",
            color: "#FFFFFF",
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: -6,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          H
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
