import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F8FAFC",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Blueprint grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(30,64,175,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.06) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Logo square */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 16,
            background: "#1E40AF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: 24,
          }}
        >
          B
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-1px",
            marginBottom: 16,
            textAlign: "center",
            padding: "0 60px",
          }}
        >
          Bitcoin Mining Farm Calculator
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "#64748B",
            textAlign: "center",
            marginBottom: 40,
            padding: "0 80px",
          }}
        >
          Bitcoin Mining Farm Calculator — Free CAPEX &amp; ROI Tool
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", padding: "0 60px" }}>
          {["CAPEX Calculator", "ROI Forecast", "Solar Offset", "Cooling Sizing", "Farm Visualizer"].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: "#DBEAFE",
                  border: "1px solid #93C5FD",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 18,
                  color: "#1E40AF",
                }}
              >
                {label}
              </div>
            )
          )}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            fontSize: 16,
            color: "#94A3B8",
          }}
        >
          Free · No Account · Browser-Based
        </div>
      </div>
    ),
    { ...size }
  );
}
