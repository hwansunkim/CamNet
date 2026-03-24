import { useState, useEffect, useRef, useCallback } from "react";
import { api, useWebSocket } from "./api";
import { normalize, serialize } from "./utils";
import { FONT_MONO, FONT_DISPLAY, COLORS, GLOBAL_CSS } from "./styles";
import ErrorBoundary from "./components/ErrorBoundary";
import GridView from "./components/GridView";
import MapView from "./components/MapView";
import ManageView from "./components/ManageView";

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cameras, setCameras]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [view, setView]         = useState("grid");
  const [time, setTime]         = useState(new Date());

  // I-2: useRef로 최신 cameras 참조 — stale closure 방지
  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

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

  // CRUD handlers
  const addCamera = useCallback(async (formData) => {
    const created = await api.createCamera(serialize(formData));
    setCameras(prev => [...prev, normalize(created)]);
  }, []);

  // I-2: camerasRef로 stale closure 방지
  const updateCamera = useCallback(async (id, updates) => {
    setCameras(prev => prev.map(cam => cam.id === id ? normalize({ ...cam, ...updates }) : cam));
    const currentCam = camerasRef.current.find(c => c.id === id);
    const updated = await api.updateCamera(id, serialize({ ...currentCam, ...updates }));
    setCameras(prev => prev.map(cam => cam.id === id ? normalize(updated) : cam));
  }, []);

  const updatePosition = useCallback(async (id, x, y) => {
    setCameras(prev => prev.map(cam => cam.id === id ? { ...cam, mapX: x, mapY: y } : cam));
    try {
      await api.updatePosition(id, x, y);
    } catch (err) {
      console.error("[API] updatePosition error", err);
    }
  }, []);

  // N-4: confirm은 ManageView에서 처리
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
    <ErrorBoundary>
      <style>{GLOBAL_CSS}</style>

      <div style={{ height: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", color: COLORS.textPrimary }}>

        {/* Top bar */}
        <div style={{
          height: 52, borderBottom: `1px solid ${COLORS.borderFaint}`, display: "flex", alignItems: "center",
          padding: "0 20px", gap: 20, flexShrink: 0, background: "#060c18",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 2 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, background: i % 2 === 0 ? COLORS.accent : COLORS.textDarkest, borderRadius: 1 }}/>)}
            </div>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 800, color: COLORS.textWhite, letterSpacing: -0.5 }}>
              CamNET
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDarker, letterSpacing: 2, marginTop: 1 }}>
              v1.0
            </span>
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} style={{
                fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 2,
                padding: "5px 14px", borderRadius: 3, cursor: "pointer",
                background: view === item.id ? COLORS.accentDim : "transparent",
                color: view === item.id ? COLORS.accent : COLORS.textDark,
                border: view === item.id ? `1px solid ${COLORS.accentBorder}` : "1px solid transparent",
                transition: "all 0.15s",
              }}>{item.icon} {item.label}</button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: wsStatus === "connected" ? COLORS.online : "#ff9900",
                boxShadow: wsStatus === "connected" ? `0 0 8px ${COLORS.online}` : "0 0 8px #ff9900",
              }}/>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#4a7060" }}>
                {onlineCount}/{cameras.length} ONLINE
              </span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDarker }}>
              {time.toLocaleTimeString("ko-KR", { hour12: false })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
          {loading ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.textDarker, letterSpacing: 3 }}>LOADING…</span>
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
          height: 28, borderTop: `1px solid ${COLORS.borderFaint}`, background: COLORS.bgDark,
          display: "flex", alignItems: "center", padding: "0 20px", gap: 24,
        }}>
          {[
            ["MediaMTX", "WebRTC/RTSP Gateway"],
            ["NETWORK",  "192.168.0.x"],
            ["WS",       wsStatus.toUpperCase()],
          ].map(([key, val]) => (
            <div key={key} style={{ display: "flex", gap: 6 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDarkest, letterSpacing: 1 }}>{key}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark }}>{val}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDarkest }}>
            {time.toLocaleDateString("ko-KR")}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
