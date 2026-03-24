import { useEffect, useRef, useCallback } from "react";

const API_BASE = "/api";

// HTTPS 환경에서는 wss:// 자동 사용 (mixed content 차단 방지)
const _wsProto = window.location.protocol === "https:" ? "wss" : "ws";
// 백엔드 WS_TOKEN과 일치하는 값을 VITE_WS_TOKEN 환경변수로 주입 (미설정 시 인증 없음)
const _wsToken = import.meta.env.VITE_WS_TOKEN || "";
const WS_URL = `${_wsProto}://${window.location.host}/ws${_wsToken ? `?token=${_wsToken}` : ""}`;

// ── REST helpers ──────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ── 카메라 CRUD ──────────────────────────────
  getCameras:     ()          => request("/cameras"),
  getCamera:      (id)        => request(`/cameras/${id}`),
  createCamera:   (data)      => request("/cameras",       { method: "POST",   body: JSON.stringify(data) }),
  updateCamera:   (id, data)  => request(`/cameras/${id}`, { method: "PATCH",  body: JSON.stringify(data) }),
  deleteCamera:   (id)        => request(`/cameras/${id}`, { method: "DELETE" }),
  checkStatus:    (id)        => request(`/cameras/${id}/check`, { method: "POST" }),
  // B-2: position endpoint now uses JSON body instead of query params
  updatePosition: (id, x, y)  => request(`/cameras/${id}/position`, {
    method: "PATCH",
    body: JSON.stringify({ map_x: x, map_y: y }),
  }),

  // ── 도면 맵 ──────────────────────────────────
  getMaps:        ()          => request("/maps"),
  createMap:      (data)      => request("/maps",          { method: "POST", body: JSON.stringify(data) }),
  updateRooms:    (id, rooms) => request(`/maps/${id}/rooms`, { method: "PUT", body: JSON.stringify(rooms) }),
};

// ── WebSocket Hook ────────────────────────────────────────────────────────────

// I-3: Exponential backoff constants
const WS_INITIAL_DELAY = 1000;
const WS_MAX_DELAY = 30000;
const WS_BACKOFF_FACTOR = 2;

/**
 * useWebSocket — 카메라 상태 실시간 수신 (with exponential backoff)
 *
 * @param {function} onStatusUpdate  ({ camera_id, status, last_seen }) => void
 * @param {function} onSnapshot      (cameras) => void  ← 최초 연결 시
 */
export function useWebSocket({ onStatusUpdate, onSnapshot }) {
  const wsRef  = useRef(null);
  const pingRef = useRef(null);
  const delayRef = useRef(WS_INITIAL_DELAY);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] connected");
      delayRef.current = WS_INITIAL_DELAY;  // 연결 성공 시 딜레이 리셋
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30_000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "snapshot")      onSnapshot?.(msg.cameras);
        if (msg.type === "status_update") onStatusUpdate?.(msg);
      } catch (err) {
        console.error("[WS] parse error", err);
      }
    };

    ws.onclose = () => {
      clearInterval(pingRef.current);
      const delay = delayRef.current;
      console.warn(`[WS] disconnected, reconnecting in ${delay / 1000}s…`);
      delayRef.current = Math.min(delay * WS_BACKOFF_FACTOR, WS_MAX_DELAY);
      setTimeout(connect, delay);
    };

    ws.onerror = (err) => console.error("[WS] error", err);
  }, [onStatusUpdate, onSnapshot]);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
