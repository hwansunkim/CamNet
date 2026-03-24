import CameraStream from "./CameraStream";
import { FONT_MONO, COLORS } from "../styles";

/**
 * Camera Card — thumbnail card with status indicator, used in grid and other views.
 */
export default function CameraCard({ camera, onClick, selected, compact }) {
  const isOnline = camera.status === "online" && camera.enabled;

  return (
    <div
      onClick={() => onClick?.(camera)}
      style={{
        position: "relative", overflow: "hidden", cursor: "pointer",
        border: selected ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
        borderRadius: 4, background: COLORS.bgCard,
        boxShadow: selected ? `0 0 20px rgba(0,229,255,0.15)` : "none",
        transition: "all 0.2s",
        display: "flex", flexDirection: "column", minHeight: compact ? 100 : 160,
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <CameraStream camera={camera} compact={compact} />
      </div>

      <div style={{
        background: COLORS.bgOverlay, borderTop: `1px solid ${COLORS.borderDark}`,
        padding: compact ? "4px 8px" : "6px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: isOnline ? COLORS.online : camera.enabled ? COLORS.offline : COLORS.disabled,
            boxShadow: isOnline ? `0 0 6px ${COLORS.online}` : "none",
          }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: compact ? 10 : 11, color: COLORS.textPrimary, letterSpacing: 0.5 }}>
            {camera.name}
          </span>
        </div>
        {!compact && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark }}>
            {camera.ip}
          </span>
        )}
      </div>

      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3 }}>
        <div style={{ width: 6, height: 6, border: `1px solid ${COLORS.border}`, borderRadius: 1 }} />
      </div>
    </div>
  );
}
