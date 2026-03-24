import { useState, useRef, useCallback } from "react";
import CameraStream from "./CameraStream";
import { FONT_MONO, COLORS, FLOOR_PLAN } from "../styles";

/**
 * Map View — SVG floor plan with draggable camera icons and side panel.
 */
export default function MapView({ cameras, onUpdatePosition }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);

  const handleMouseDown = useCallback((e, camId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(camId);
    setSelected(camId);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdatePosition(dragging, Math.max(2, Math.min(96, x)), Math.max(2, Math.min(96, y)));
  }, [dragging, onUpdatePosition]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const selectedCam = cameras.find(c => c.id === selected);

  return (
    <div style={{ height: "100%", display: "flex", gap: 16 }}>
      <div style={{ flex: 1, position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block", cursor: dragging ? "grabbing" : "default", userSelect: "none" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#0f1828" strokeWidth="0.2"/>
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <rect width="100" height="100" fill={COLORS.bg}/>
          <rect width="100" height="100" fill="url(#grid)"/>
          <rect x="3" y="3" width="94" height="94" fill="none" stroke="#1e3050" strokeWidth="0.8"/>

          {FLOOR_PLAN.rooms.map(room => (
            <g key={room.id}>
              <rect x={room.x} y={room.y} width={room.w} height={room.h}
                fill={room.color} stroke="#1e3050" strokeWidth="0.5"/>
              <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 1.5}
                textAnchor="middle" fill="#2a4060" fontSize="3.5"
                style={{ fontFamily: FONT_MONO, pointerEvents: "none" }}>
                {room.label}
              </text>
            </g>
          ))}

          {/* Door indicators */}
          <line x1="50" y1="23" x2="57" y2="23" stroke={COLORS.accent} strokeWidth="0.6" opacity="0.4"/>
          <line x1="57" y1="23" x2="57" y2="28" stroke={COLORS.accent} strokeWidth="0.6" opacity="0.4"/>
          <line x1="43" y1="62" x2="43" y2="65" stroke={COLORS.accent} strokeWidth="0.6" opacity="0.4"/>
          <line x1="55" y1="58" x2="55" y2="62" stroke={COLORS.accent} strokeWidth="0.6" opacity="0.4"/>

          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            const isSelected = selected === cam.id;
            const isHovered = hovered === cam.id;
            const color = isOnline ? COLORS.online : cam.enabled ? COLORS.offline : "#334";

            return (
              <g key={cam.id} transform={`translate(${cam.mapX}, ${cam.mapY})`}
                onMouseDown={(e) => handleMouseDown(e, cam.id)}
                onMouseEnter={() => setHovered(cam.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "grab" }}>

                {(isSelected || isHovered) && (
                  <circle r="4.5" fill="none" stroke={isSelected ? COLORS.accent : "#336"} strokeWidth="0.4"
                    strokeDasharray={isHovered && !isSelected ? "1 1" : "none"} filter="url(#glow)"/>
                )}

                {isOnline && (
                  <circle r="4" fill="none" stroke={color} strokeWidth="0.3" opacity="0.3">
                    <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                  </circle>
                )}

                <rect x="-2.8" y="-2" width="4.8" height="3.2" rx="0.5"
                  fill={isSelected ? COLORS.accent : "#0a1422"} stroke={color} strokeWidth="0.4"
                  filter={isOnline ? "url(#glow)" : "none"}/>
                <polygon points="2,-.8 3.5,-1.5 3.5,.5 2,.2"
                  fill={isSelected ? COLORS.accent : "#0a1422"} stroke={color} strokeWidth="0.3"/>
                <circle cx="-0.8" cy="-0.4" r="0.8" fill={color} opacity={isOnline ? 1 : 0.3}/>

                <text x="0" y="4" textAnchor="middle" fill={isSelected ? COLORS.accent : "#5070a0"} fontSize="2.2"
                  style={{ fontFamily: FONT_MONO, pointerEvents: "none" }}>
                  {cam.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 16 }}>
          {[[COLORS.online, "온라인"], [COLORS.offline, "오프라인"], ["#334455", "비활성"]].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDark }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 12, left: 12 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDarker, letterSpacing: 2 }}>
            드래그하여 카메라 위치 조정
          </span>
        </div>
      </div>

      <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDark, letterSpacing: 2, marginBottom: 4 }}>
          CAMERA LIST
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            return (
              <div key={cam.id} onClick={() => setSelected(cam.id === selected ? null : cam.id)}
                style={{
                  padding: "8px 12px", borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${selected === cam.id ? COLORS.accent : COLORS.border}`,
                  background: selected === cam.id ? COLORS.accentDim : COLORS.bgCard,
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? COLORS.online : cam.enabled ? COLORS.offline : COLORS.disabled, flexShrink: 0 }}/>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textPrimary, flex: 1 }}>{cam.name}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark }}>{cam.room}</span>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCam && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ aspectRatio: "16/9", position: "relative" }}>
              <CameraStream camera={selectedCam} compact />
            </div>
            <div style={{ padding: "8px 10px", background: COLORS.bgCard }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textPrimary }}>{selectedCam.name}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark, marginTop: 2 }}>
                {selectedCam.ip}:{selectedCam.port}/{selectedCam.path}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
