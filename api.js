/**
 * CamNET API client
 * React에서 백엔드 REST API 및 WebSocket과 통신하는 훅 모음
 */

const API_BASE = "/api";
const WS_URL   = `ws://${window.location.host}/ws`;

// ── REST helpers ─────────────────────────────────────────────────────────────

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
  getCameras:      ()           => request("/cameras"),
  getCamera:       (id)         => request(`/cameras/${id}`),
  createCamera:    (data)       => request("/cameras",      { method: "POST", body: JSON.stringify(data) }),
  updateCamera:    (id, data)   => request(`/cameras/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCamera:    (id)         => request(`/cameras/${id}`, { method: "DELETE" }),
  checkStatus:     (id)         => request(`/cameras/${id}/check`, { method: "POST" }),
  updatePosition:  (id, x, y)  => request(`/cameras/${id}/position?map_x=${x}&map_y=${y}`, { method: "PATCH" }),

  // ── 도면 맵 ──────────────────────────────────
  getMaps:         ()           => request("/maps"),
  createMap:       (data)       => request("/maps",         { method: "POST", body: JSON.stringify(data) }),
  updateRooms:     (id, rooms)  => request(`/maps/${id}/rooms`, { method: "PUT", body: JSON.stringify(rooms) }),
};

// ── WebSocket Hook ────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";

/**
 * useWebSocket — 카메라 상태 실시간 수신
 *
 * @param {function} onStatusUpdate  ({ camera_id, status, last_seen }) => void
 * @param {function} onSnapshot      (cameras) => void  ← 최초 연결 시
 */
export function useWebSocket({ onStatusUpdate, onSnapshot }) {
  const wsRef  = useRef(null);
  const pingRef = useRef(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] connected");
      // 30초마다 ping으로 연결 유지
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
      console.warn("[WS] disconnected, reconnecting in 3s…");
      clearInterval(pingRef.current);
      setTimeout(connect, 3_000);   // 자동 재연결
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
