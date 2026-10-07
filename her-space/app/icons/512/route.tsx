import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 64,
          background: "linear-gradient(135deg, #E8A0BF 0%, #B79CED 54%, #8FA8E8 100%)",
          boxShadow: "inset 0 0 0 16px rgba(255,255,255,0.18)",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "60%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 36,
            background: "rgba(255,255,255,0.12)",
            color: "#FFFFFF",
            fontSize: 280,
            fontWeight: 800,
            letterSpacing: -18,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          H
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
