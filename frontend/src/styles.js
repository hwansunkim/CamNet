// ─── Common styles ────────────────────────────────────────────────────────────
// Shared style constants to avoid inline repetition across components.

export const FONT_MONO = "'JetBrains Mono', monospace";
export const FONT_DISPLAY = "'Syne', sans-serif";

export const COLORS = {
  bg:          "#050810",
  bgCard:      "#080e18",
  bgDark:      "#040810",
  bgOverlay:   "rgba(5,8,16,0.95)",
  border:      "#1e2d40",
  borderDark:  "#1a2535",
  borderFaint: "#0f1a2a",
  accent:      "#00e5ff",
  accentDim:   "rgba(0,229,255,0.08)",
  accentBorder:"rgba(0,229,255,0.25)",
  online:      "#00ff88",
  offline:     "#ff4444",
  disabled:    "#333",
  textPrimary: "#c0cce0",
  textBright:  "#d0dced",
  textWhite:   "#e0ecff",
  textDim:     "#4a6080",
  textDark:    "#3a5070",
  textDarker:  "#2a4060",
  textDarkest: "#1e3050",
};

export const btnStyle = {
  fontFamily: FONT_MONO, fontSize: 11, padding: "5px 10px",
  background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`,
  borderRadius: 3, cursor: "pointer",
};

export const inputStyle = {
  width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 3,
  padding: "6px 10px", color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 12,
  outline: "none", boxSizing: "border-box",
};

export const labelStyle = {
  fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textDim,
  letterSpacing: 1, display: "block", marginBottom: 4,
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${COLORS.bg}; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0a0f1a; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.textDarkest}; border-radius: 2px; }
  select option { background: ${COLORS.bgCard}; color: ${COLORS.textPrimary}; }
`;

// ─── Floor plan definition ────────────────────────────────────────────────────
export const FLOOR_PLAN = {
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
