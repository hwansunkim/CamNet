import { FONT_MONO, COLORS } from "../styles";

/**
 * Camera Stream Component — renders an iframe for WebRTC or an offline placeholder.
 */
export default function CameraStream({ camera, compact = false }) {
  const webrtcUrl = `http://${camera.ip}:${camera.port}/${camera.path}/`;

  if (!camera.enabled || camera.status === "offline") {
    return (
      <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: compact ? 24 : 40, opacity: 0.15 }}>◼</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: compact ? 9 : 11, color: camera.enabled ? COLORS.offline : COLORS.disabled, letterSpacing: 2, textTransform: "uppercase" }}>
          {camera.enabled ? "OFFLINE" : "DISABLED"}
        </div>
        {!compact && <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.disabled, marginTop: 4 }}>{webrtcUrl}</div>}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <iframe
        src={webrtcUrl}
        style={{ width: "100%", height: "100%", border: "none", background: COLORS.bg }}
        allow="camera; microphone; autoplay"
        title={camera.name}
      />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        mixBlendMode: "multiply",
      }} />
    </div>
  );
}
