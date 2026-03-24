import { useState } from "react";
import CameraCard from "./CameraCard";
import { FONT_MONO, COLORS, btnStyle } from "../styles";

/**
 * Grid View — multi-layout camera grid with pagination.
 */
export default function GridView({ cameras }) {
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
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1,
              padding: "5px 12px", borderRadius: 3, cursor: "pointer",
              background: layout === l ? COLORS.accent : "transparent",
              color: layout === l ? "#020810" : COLORS.textDim,
              border: layout === l ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
              transition: "all 0.15s",
            }}>{l}</button>
          ))}
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ ...btnStyle, opacity: page === 0 ? 0.3 : 1 }}>◀</button>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textDim }}>
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
            border: `1px dashed ${COLORS.borderDark}`, borderRadius: 4, background: COLORS.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.border, letterSpacing: 2 }}>NO SIGNAL</span>
          </div>
        ))}
      </div>
    </div>
  );
}
