import { useState } from "react";
import { FONT_MONO, COLORS, btnStyle, inputStyle, labelStyle } from "../styles";

/**
 * Manage View — camera CRUD management panel with form.
 */
export default function ManageView({ cameras, onAdd, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const emptyForm = { name: "", ip: "", port: 8889, rtspPort: 8554, apiPort: 9997, apiUsername: "", apiPassword: "", path: "cam", protocol: "webrtc", room: "", enabled: true, mapX: 50, mapY: 50 };
  const [form, setForm] = useState(emptyForm);

  const openAdd  = () => { setForm(emptyForm); setEditing(null); setFormError(null); setShowForm(true); };
  const openEdit = (cam) => {
    setForm({
      ...cam,
      rtspPort:    cam.rtspPort    ?? cam.rtsp_port    ?? 8554,
      apiPort:     cam.apiPort     ?? cam.api_port     ?? 9997,
      apiUsername: cam.apiUsername ?? cam.api_username ?? "",
      apiPassword: cam.apiPassword ?? cam.api_password ?? "",
      mapX:        cam.mapX        ?? cam.map_x        ?? 50,
      mapY:        cam.mapY        ?? cam.map_y        ?? 50,
    });
    setEditing(cam.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.ip || !form.path) {
      setFormError("이름, IP, 경로는 필수 항목입니다.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await onUpdate(editing, form);
      else await onAdd(form);
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setFormError(err.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // N-4: 삭제 확인 다이얼로그
  const handleDelete = (id) => {
    if (window.confirm("정말로 이 카메라를 삭제하시겠습니까?")) {
      onDelete(id);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", gap: 16 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textDim, letterSpacing: 2 }}>
            {cameras.length} CAMERAS REGISTERED
          </span>
          <button onClick={openAdd} style={{
            fontFamily: FONT_MONO, fontSize: 11, padding: "6px 16px",
            background: COLORS.accent, color: "#020810", border: "none", borderRadius: 3, cursor: "pointer", letterSpacing: 1,
          }}>+ 카메라 추가</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {cameras.map(cam => {
            const isOnline = cam.status === "online" && cam.enabled;
            const webrtcUrl = `http://${cam.ip}:${cam.port}/${cam.path}/`;
            const rtspUrl   = `rtsp://${cam.ip}:${cam.rtspPort ?? cam.rtsp_port ?? 8554}/${cam.path}`;
            return (
              <div key={cam.id} style={{ border: `1px solid ${COLORS.borderDark}`, borderRadius: 4, background: COLORS.bgCard, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? COLORS.online : cam.enabled ? COLORS.offline : COLORS.disabled, marginTop: 4, flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLORS.textBright, fontWeight: 600 }}>{cam.name}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDarker, background: "#0a1422", padding: "2px 6px", borderRadius: 2 }}>{cam.room}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: isOnline ? COLORS.online : COLORS.offline, marginLeft: "auto" }}>
                        {cam.status?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDark, marginBottom: 2 }}>{webrtcUrl}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#2a4050" }}>{rtspUrl}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onUpdate(cam.id, { enabled: !cam.enabled })} style={{
                      fontFamily: FONT_MONO, fontSize: 10, padding: "4px 10px",
                      background: "transparent", color: cam.enabled ? COLORS.online : COLORS.textDim,
                      border: `1px solid ${cam.enabled ? "#00ff8844" : COLORS.border}`, borderRadius: 3, cursor: "pointer",
                    }}>{cam.enabled ? "ON" : "OFF"}</button>
                    <button onClick={() => openEdit(cam)} style={{ ...btnStyle, fontSize: 10, padding: "4px 10px" }}>편집</button>
                    <button onClick={() => handleDelete(cam.id)} style={{
                      fontFamily: FONT_MONO, fontSize: 10, padding: "4px 10px",
                      background: "transparent", color: COLORS.offline, border: "1px solid #ff444422", borderRadius: 3, cursor: "pointer",
                    }}>삭제</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <div style={{ width: 300, border: `1px solid ${COLORS.border}`, borderRadius: 4, background: COLORS.bgCard, padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.accent, letterSpacing: 2 }}>
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

          {/* MediaMTX API 인증 */}
          <div style={{ borderTop: `1px solid ${COLORS.borderDark}`, paddingTop: 12 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDarker, letterSpacing: 2, marginBottom: 10 }}>
              MEDIAMTX API AUTH <span style={{ color: COLORS.textDarkest }}>(선택)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>API 포트</label>
                <input type="number" value={form.apiPort} onChange={e => setForm(f => ({ ...f, apiPort: +e.target.value }))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>사용자명</label>
                <input value={form.apiUsername} onChange={e => setForm(f => ({ ...f, apiUsername: e.target.value }))}
                  placeholder="admin" style={inputStyle}/>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>비밀번호</label>
              <input type="password" value={form.apiPassword} onChange={e => setForm(f => ({ ...f, apiPassword: e.target.value }))}
                placeholder="••••••••" style={inputStyle}/>
            </div>
          </div>

          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.borderDark}`, borderRadius: 3, padding: 10 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark, marginBottom: 4 }}>WEBRTC URL</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#4a7090", wordBreak: "break-all" }}>
              http://{form.ip || "ip"}:{form.port}/{form.path}/
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textDark, marginTop: 6, marginBottom: 4 }}>RTSP URL</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#4a7090", wordBreak: "break-all" }}>
              rtsp://{form.ip || "ip"}:{form.rtspPort}/{form.path}
            </div>
          </div>

          {formError && (
            <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid #ff444444", borderRadius: 3, padding: "8px 10px" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#ff6666" }}>{formError}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSubmit} disabled={saving} style={{
              flex: 1, fontFamily: FONT_MONO, fontSize: 11, padding: "8px",
              background: saving ? "#005566" : COLORS.accent, color: "#020810", border: "none", borderRadius: 3,
              cursor: saving ? "not-allowed" : "pointer", letterSpacing: 1, opacity: saving ? 0.7 : 1,
            }}>{saving ? "저장 중…" : "저장"}</button>
            <button onClick={() => setShowForm(false)} disabled={saving} style={{ ...btnStyle, fontSize: 11, padding: "8px 16px" }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
