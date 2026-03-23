import { useState, useEffect, useRef, useCallback } from "react";
import { api, useWebSocket } from "./api";

// ─── Field mapping helpers ────────────────────────────────────────────────────
// API returns snake_case; UI uses camelCase
const normalize = (cam) => ({
  ...cam,
  mapX:     cam.map_x     ?? cam.mapX     ?? 50,
  mapY:     cam.map_y     ?? cam.mapY     ?? 50,
  rtspPort: cam.rtsp_port ?? cam.rtspPort ?? 8554,
  apiPort:  cam.api_port  ?? cam.apiPort  ?? 9997,
});

const serialize = (cam) => ({
  name:      cam.name,
  ip:        cam.ip,
  port:      cam.port      ?? 8889,
  rtsp_port: cam.rtspPort  ?? cam.rtsp_port ?? 8554,
  api_port:  cam.apiPort   ?? cam.api_port  ?? 9997,
  path:      cam.path,
  protocol:  cam.protocol  ?? "webrtc",
  room:      cam.room      ?? "",
  map_x:     cam.mapX      ?? cam.map_x     ?? 50,
  map_y:     cam.mapY      ?? cam.map_y     ?? 50,
  enabled:   cam.enabled   ?? true,
});

// ─── Floor plan definition ────────────────────────────────────────────────────
const FLOOR_PLAN = {
  rooms: [
    { id: "entrance",  label: "현관",  x: 38, y: 5,  w: 24, h: 18, color: "#1a2030" },
    { id: "living",    label: "거실",  x: 5,  y: 28, w: 50, h: 34, color: "#141c28" },
    { id: "kitchen",   label: "주방",  x: 60, y: 28, w: 35, h: 28, color: "#1a2030" },
    { id: "main-bed",  label: "안방",  x: 5,  y: 65, w: 35, h: 30, color: "#141c28" },
    { id: "bathroom",  label: "화장실", x: 72, y: 5,  w: 23, h: 20, color: "#1a2030" },
    { id: "small-bed", label: "작은방", x: 55, y: 60, w: 40, h: 35, color: "#141c28" },
    { id: "corridor",  label: "복도",  x: 43, y: 28, w: 14, h: 34, color: "#0f1520" },
  ],
};

// ─── Camera Stream Component ──────────────────────────────────────────────────
function CameraStream({ camera, compact = false }) {
  const webrtcUrl = `http://${camera.ip}:${camera.port}/${camera.path}/`;

  if (!camera.enabled || camera.status === "offline") {
    return (
      <div style={{ width: "100%", height: "100%", background: "#050810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: compact ? 24 : 40, opacity: 0.15 }}>◼</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: compact ? 9 : 11, color: camera.enabled ? "#ff4444" : "#444", letterSpacing: 2, textTransform: "uppercase" }}>
          {camera.enabled ? "OFFLINE" : "DISABLED"}
        </div>
        {!compact && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#333", marginTop: 4 }}>{webrtcUrl}</div>}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <iframe
        src={webrtcUrl}
        style={{ width: "100%", height: "100%", border: "none", background: "#050810" }}
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

// ─── Camera Card ──────────────────────────────────────────────────────────────
function CameraCard({ camera, onClick, selected, compact }) {
  const isOnline = camera.status === "online" && camera.enabled;

  return (
    <div
      onClick={() => onClick?.(camera)}
      style={{
        position: "relative", overflow: "hidden", cursor: "pointer",
        border: selected ? "1px solid #00e5ff" : "1px solid #1e2d40",
        borderRadius: 4, background: "#080e18",
        boxShadow: selected ? "0 0 20px rgba(0,229,255,0.15)" : "none",
        transition: "all 0.2s",
        display: "flex", flexDirection: "column", minHeight: compact ? 100 : 160,
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <CameraStream camera={camera} compact={compact} />
      </div>

      <div style={{
        background: "rgba(5,8,16,0.95)", borderTop: "1px solid #1a2535",
        padding: compact ? "4px 8px" : "6px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
            background: isOnline ? "#00ff88" : camera.enabled ? "#ff4444" : "#333",
            boxShadow: isOnline ? "0 0 6px #00ff88" : "none",
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: compact ? 10 : 11, color: "#c0cce0", letterSpacing: 0.5 }}>
            {camera.name}
          </span>
        </div>
        {!compact && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070" }}>
            {camera.ip}
          </span>
        )}
      </div>

      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3 }}>
        <div style={{ width: 6, height: 6, border: "1px solid #1e2d40", borderRadius: 1 }} />
      </div>
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────
function GridView({ cameras }) {
  const [layout, setLayout] = useState("2x2");
  const [page, setPage] = useState(0);
  const onlineCams = cameras.filter(c => c.enabled);

  const layouts = {
    "1x1": { cols: 1, count: 1 },
    "2x2": { cols: 2, count: 4 },
    "3x3": { cols: 3, count: 9 },
    "4x4": { cols: 4, count: 16 },
  };

  const { cols, count } = layouts[layout];
  const totalPages = Math.ceil(onlineCams.length / count);
  const visible = onlineCams.slice(page * count, page * count + count);
  const slots = [...visible, ...Array(Math.max(0, count - visible.length)).fill(null)];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {Object.keys(layouts).map(l => (
            <button key={l} onClick={() => { setLayout(l); setPage(0); }} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1,
              padding: "5px 12px", borderRadius: 3, cursor: "pointer",
              background: layout === l ? "#00e5ff" : "transparent",
              color: layout === l ? "#020810" : "#4a6080",
              border: layout === l ? "1px solid #00e5ff" : "1px solid #1e2d40",
              transition: "all 0.15s",
            }}>{l}</button>
          ))}
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ ...btnStyle, opacity: page === 0 ? 0.3 : 1 }}>◀</button>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a6080" }}>
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ ...btnStyle, opacity: page === totalPages - 1 ? 0.3 : 1 }}>▶</button>
          </div>
        )}
      </div>

      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${count / cols}, 1fr)`,
        gap: 6, minHeight: 0,
      }}>
        {slots.map((cam, i) => cam ? (
          <CameraCard key={cam.id} camera={cam} compact={cols >= 3} />
        ) : (
          <div key={i} style={{
            border: "1px dashed #1a2535", borderRadius: 4, background: "#050810",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#1e2d40", letterSpacing: 2 }}>NO SIGNAL</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "5px 10px",
  background: "transparent", color: "#4a6080", border: "1px solid #1e2d40",
  borderRadius: 3, cursor: "pointer",
};

// ─── Floor Map View ───────────────────────────────────────────────────────────
function MapView({ cameras, onUpdatePosition }) {
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

          <rect width="100" height="100" fill="#050810"/>
          <rect width="100" height="100" fill="url(#grid)"/>
          <rect x="3" y="3" width="94" height="94" fill="none" stroke="#1e3050" strokeWidth="0.8"/>

          {FLOOR_PLAN.rooms.map(room => (
            <g key={room.id}>
              <rect x={room.x} y={room.y} width={room.w} height={room.h}
                fill={room.color} stroke="#1e3050" strokeWidth="0.5"/>
              <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 1.5}
                textAnchor="middle" fill="#2a4060" fontSize="3.5"
                style={{ fontFamily: "'JetBrains Mono', monospace", pointerEvents: "none" }}>
                {room.label}
              </text>
            </g>
          ))}

          {/* Door indicators */}
          <line x1="50" y1="23" x2="57" y2="23" stroke="#00e5ff" strokeWidth="0.6" opacity="0.4"/>
          <line x1="57" y1="23" x2="57" y2="28" stroke="#00e5ff" strokeWidth="0.6" opacity="0.4"/>
          <line x1="43" y1="62" x2="43" y2="65" stroke="#00e5ff" strokeWidth="0.6" opacity="0.4"/>
          <line x1="55" y1="58" x2="55" y2="62" stroke="#00e5ff" strokeWidth="0.6" opacity="0.4"/>

          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            const isSelected = selected === cam.id;
            const isHovered = hovered === cam.id;
            const color = isOnline ? "#00ff88" : cam.enabled ? "#ff4444" : "#334";

            return (
              <g key={cam.id} transform={`translate(${cam.mapX}, ${cam.mapY})`}
                onMouseDown={(e) => handleMouseDown(e, cam.id)}
                onMouseEnter={() => setHovered(cam.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "grab" }}>

                {(isSelected || isHovered) && (
                  <circle r="4.5" fill="none" stroke={isSelected ? "#00e5ff" : "#336"} strokeWidth="0.4"
                    strokeDasharray={isHovered && !isSelected ? "1 1" : "none"} filter="url(#glow)"/>
                )}

                {isOnline && (
                  <circle r="4" fill="none" stroke={color} strokeWidth="0.3" opacity="0.3">
                    <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                  </circle>
                )}

                <rect x="-2.8" y="-2" width="4.8" height="3.2" rx="0.5"
                  fill={isSelected ? "#00e5ff" : "#0a1422"} stroke={color} strokeWidth="0.4"
                  filter={isOnline ? "url(#glow)" : "none"}/>
                <polygon points="2,-.8 3.5,-1.5 3.5,.5 2,.2"
                  fill={isSelected ? "#00e5ff" : "#0a1422"} stroke={color} strokeWidth="0.3"/>
                <circle cx="-0.8" cy="-0.4" r="0.8" fill={color} opacity={isOnline ? 1 : 0.3}/>

                <text x="0" y="4" textAnchor="middle" fill={isSelected ? "#00e5ff" : "#5070a0"} fontSize="2.2"
                  style={{ fontFamily: "'JetBrains Mono', monospace", pointerEvents: "none" }}>
                  {cam.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 16 }}>
          {[["#00ff88", "온라인"], ["#ff4444", "오프라인"], ["#334455", "비활성"]].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a5070" }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 12, left: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2a4060", letterSpacing: 2 }}>
            드래그하여 카메라 위치 조정
          </span>
        </div>
      </div>

      <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a5070", letterSpacing: 2, marginBottom: 4 }}>
          CAMERA LIST
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            return (
              <div key={cam.id} onClick={() => setSelected(cam.id === selected ? null : cam.id)}
                style={{
                  padding: "8px 12px", borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${selected === cam.id ? "#00e5ff" : "#1e2d40"}`,
                  background: selected === cam.id ? "rgba(0,229,255,0.05)" : "#080e18",
                  transition: "all 0.15s",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#00ff88" : cam.enabled ? "#ff4444" : "#333", flexShrink: 0 }}/>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#c0cce0", flex: 1 }}>{cam.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070" }}>{cam.room}</span>
                </div>
              </div>
            );
          })}
        </div>

        {selectedCam && (
          <div style={{ border: "1px solid #1e2d40", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ aspectRatio: "16/9", position: "relative" }}>
              <CameraStream camera={selectedCam} compact />
            </div>
            <div style={{ padding: "8px 10px", background: "#080e18" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#c0cce0" }}>{selectedCam.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070", marginTop: 2 }}>
                {selectedCam.ip}:{selectedCam.port}/{selectedCam.path}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Camera Management ────────────────────────────────────────────────────────
function ManageView({ cameras, onAdd, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const emptyForm = { name: "", ip: "", port: 8889, rtspPort: 8554, apiPort: 9997, path: "cam", protocol: "webrtc", room: "", enabled: true, mapX: 50, mapY: 50 };
  const [form, setForm] = useState(emptyForm);

  const openAdd  = () => { setForm(emptyForm); setEditing(null); setShowForm(true); };
  const openEdit = (cam) => { setForm({ ...cam, rtspPort: cam.rtspPort ?? cam.rtsp_port ?? 8554, apiPort: cam.apiPort ?? cam.api_port ?? 9997, mapX: cam.mapX ?? cam.map_x ?? 50, mapY: cam.mapY ?? cam.map_y ?? 50 }); setEditing(cam.id); setShowForm(true); };

  const handleSubmit = () => {
    if (!form.name || !form.ip || !form.path) return;
    if (editing) onUpdate(editing, form);
    else onAdd(form);
    setShowForm(false);
    setEditing(null);
  };

  const inputStyle = {
    width: "100%", background: "#050810", border: "1px solid #1e2d40", borderRadius: 3,
    padding: "6px 10px", color: "#c0cce0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a6080",
    letterSpacing: 1, display: "block", marginBottom: 4,
  };

  return (
    <div style={{ height: "100%", display: "flex", gap: 16 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4a6080", letterSpacing: 2 }}>
            {cameras.length} CAMERAS REGISTERED
          </span>
          <button onClick={openAdd} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "6px 16px",
            background: "#00e5ff", color: "#020810", border: "none", borderRadius: 3, cursor: "pointer", letterSpacing: 1,
          }}>+ 카메라 추가</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            const webrtcUrl = `http://${cam.ip}:${cam.port}/${cam.path}/`;
            const rtspUrl   = `rtsp://${cam.ip}:${cam.rtspPort ?? cam.rtsp_port ?? 8554}/${cam.path}`;
            return (
              <div key={cam.id} style={{ border: "1px solid #1a2535", borderRadius: 4, background: "#080e18", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#00ff88" : cam.enabled ? "#ff4444" : "#333", marginTop: 4, flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#d0dced", fontWeight: 600 }}>{cam.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2a4060", background: "#0a1422", padding: "2px 6px", borderRadius: 2 }}>{cam.room}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isOnline ? "#00ff88" : "#ff4444", marginLeft: "auto" }}>
                        {cam.status?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#3a5070", marginBottom: 2 }}>{webrtcUrl}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2a4050" }}>{rtspUrl}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onUpdate(cam.id, { enabled: !cam.enabled })} style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: "4px 10px",
                      background: "transparent", color: cam.enabled ? "#00ff88" : "#4a6080",
                      border: `1px solid ${cam.enabled ? "#00ff8844" : "#1e2d40"}`, borderRadius: 3, cursor: "pointer",
                    }}>{cam.enabled ? "ON" : "OFF"}</button>
                    <button onClick={() => openEdit(cam)} style={{ ...btnStyle, fontSize: 10, padding: "4px 10px" }}>편집</button>
                    <button onClick={() => onDelete(cam.id)} style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: "4px 10px",
                      background: "transparent", color: "#ff4444", border: "1px solid #ff444422", borderRadius: 3, cursor: "pointer",
                    }}>삭제</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <div style={{ width: 300, border: "1px solid #1e2d40", borderRadius: 4, background: "#080e18", padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#00e5ff", letterSpacing: 2 }}>
            {editing ? "EDIT CAMERA" : "ADD CAMERA"}
          </div>

          {[
            { key: "name",  label: "카메라 이름", placeholder: "현관문" },
            { key: "ip",    label: "IP 주소",     placeholder: "192.168.0.47" },
            { key: "room",  label: "위치 / 공간", placeholder: "현관" },
            { key: "path",  label: "스트림 경로", placeholder: "cam" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} style={inputStyle}/>
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>WebRTC 포트</label>
              <input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: +e.target.value }))} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>RTSP 포트</label>
              <input type="number" value={form.rtspPort} onChange={e => setForm(f => ({ ...f, rtspPort: +e.target.value }))} style={inputStyle}/>
            </div>
          </div>

          <div>
            <label style={labelStyle}>프로토콜</label>
            <select value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value }))} style={inputStyle}>
              <option value="webrtc">WebRTC</option>
              <option value="rtsp">RTSP</option>
            </select>
          </div>

          <div style={{ background: "#050810", border: "1px solid #1a2535", borderRadius: 3, padding: 10 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070", marginBottom: 4 }}>WEBRTC URL</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a7090", wordBreak: "break-all" }}>
              http://{form.ip || "ip"}:{form.port}/{form.path}/
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070", marginTop: 6, marginBottom: 4 }}>RTSP URL</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a7090", wordBreak: "break-all" }}>
              rtsp://{form.ip || "ip"}:{form.rtspPort}/{form.path}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSubmit} style={{
              flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "8px",
              background: "#00e5ff", color: "#020810", border: "none", borderRadius: 3, cursor: "pointer", letterSpacing: 1,
            }}>저장</button>
            <button onClick={() => setShowForm(false)} style={{ ...btnStyle, fontSize: 11, padding: "8px 16px" }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cameras, setCameras]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [view, setView]         = useState("grid");
  const [time, setTime]         = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Initial load from REST API
  useEffect(() => {
    api.getCameras()
      .then(data => setCameras(data.map(normalize)))
      .catch(err => console.error("[API] getCameras error", err))
      .finally(() => setLoading(false));
  }, []);

  // WebSocket: real-time status updates
  const handleSnapshot = useCallback((snapshotCams) => {
    setWsStatus("connected");
    setCameras(prev => prev.map(cam => {
      const update = snapshotCams.find(s => s.id === cam.id);
      return update ? { ...cam, status: update.status, enabled: update.enabled } : cam;
    }));
  }, []);

  const handleStatusUpdate = useCallback(({ camera_id, status }) => {
    setCameras(prev => prev.map(cam => cam.id === camera_id ? { ...cam, status } : cam));
  }, []);

  useWebSocket({ onStatusUpdate: handleStatusUpdate, onSnapshot: handleSnapshot });

  // CRUD handlers (optimistic UI + API sync)
  const addCamera = useCallback(async (formData) => {
    try {
      const created = await api.createCamera(serialize(formData));
      setCameras(prev => [...prev, normalize(created)]);
    } catch (err) {
      console.error("[API] createCamera error", err);
    }
  }, []);

  const updateCamera = useCallback(async (id, updates) => {
    // Optimistic update
    setCameras(prev => prev.map(cam => cam.id === id ? normalize({ ...cam, ...updates }) : cam));
    try {
      const updated = await api.updateCamera(id, serialize({ ...cameras.find(c => c.id === id), ...updates }));
      setCameras(prev => prev.map(cam => cam.id === id ? normalize(updated) : cam));
    } catch (err) {
      console.error("[API] updateCamera error", err);
    }
  }, [cameras]);

  const updatePosition = useCallback(async (id, x, y) => {
    // Optimistic update for smooth drag
    setCameras(prev => prev.map(cam => cam.id === id ? { ...cam, mapX: x, mapY: y } : cam));
    try {
      await api.updatePosition(id, x, y);
    } catch (err) {
      console.error("[API] updatePosition error", err);
    }
  }, []);

  const deleteCamera = useCallback(async (id) => {
    setCameras(prev => prev.filter(cam => cam.id !== id));
    try {
      await api.deleteCamera(id);
    } catch (err) {
      console.error("[API] deleteCamera error", err);
    }
  }, []);

  const onlineCount = cameras.filter(c => c.status === "online" && c.enabled).length;

  const navItems = [
    { id: "grid",   label: "GRID",    icon: "▦" },
    { id: "map",    label: "MAP",     icon: "⌖" },
    { id: "manage", label: "CAMERAS", icon: "☷" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #050810; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f1a; }
        ::-webkit-scrollbar-thumb { background: #1e3050; border-radius: 2px; }
        select option { background: #080e18; color: #c0cce0; }
      `}</style>

      <div style={{ height: "100vh", background: "#050810", display: "flex", flexDirection: "column", color: "#c0cce0" }}>

        {/* Top bar */}
        <div style={{
          height: 52, borderBottom: "1px solid #0f1a2a", display: "flex", alignItems: "center",
          padding: "0 20px", gap: 20, flexShrink: 0, background: "#060c18",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 2 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, background: i % 2 === 0 ? "#00e5ff" : "#1e3050", borderRadius: 1 }}/>)}
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: "#e0ecff", letterSpacing: -0.5 }}>
              CamNET
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2a4060", letterSpacing: 2, marginTop: 1 }}>
              v1.0
            </span>
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 2,
                padding: "5px 14px", borderRadius: 3, cursor: "pointer",
                background: view === item.id ? "rgba(0,229,255,0.08)" : "transparent",
                color: view === item.id ? "#00e5ff" : "#3a5070",
                border: view === item.id ? "1px solid rgba(0,229,255,0.25)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>{item.icon} {item.label}</button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: wsStatus === "connected" ? "#00ff88" : "#ff9900",
                boxShadow: wsStatus === "connected" ? "0 0 8px #00ff88" : "0 0 8px #ff9900",
              }}/>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a7060" }}>
                {onlineCount}/{cameras.length} ONLINE
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2a4060" }}>
              {time.toLocaleTimeString("ko-KR", { hour12: false })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
          {loading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#2a4060", letterSpacing: 3 }}>LOADING…</span>
            </div>
          ) : (
            <>
              {view === "grid"   && <GridView cameras={cameras} />}
              {view === "map"    && <MapView cameras={cameras} onUpdatePosition={updatePosition} />}
              {view === "manage" && <ManageView cameras={cameras} onAdd={addCamera} onUpdate={updateCamera} onDelete={deleteCamera} />}
            </>
          )}
        </div>

        {/* Bottom status */}
        <div style={{
          height: 28, borderTop: "1px solid #0f1a2a", background: "#040810",
          display: "flex", alignItems: "center", padding: "0 20px", gap: 24,
        }}>
          {[
            ["MediaMTX", "WebRTC/RTSP Gateway"],
            ["NETWORK",  "192.168.0.x"],
            ["WS",       wsStatus.toUpperCase()],
          ].map(([key, val]) => (
            <div key={key} style={{ display: "flex", gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e3050", letterSpacing: 1 }}>{key}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#3a5070" }}>{val}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e3050" }}>
            {time.toLocaleDateString("ko-KR")}
          </div>
        </div>
      </div>
    </>
  );
}
