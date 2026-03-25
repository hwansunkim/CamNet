import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { FONT_MONO, COLORS } from "../styles";

/**
 * Camera Stream Component — HLS 스트림을 Nginx 프록시를 통해 재생.
 * - 모든 트래픽이 CamNet 서버(포트 80)를 통해 중계되므로 인터넷 접속 가능.
 * - hls.js: Chrome/Firefox 등 MSE 지원 브라우저
 * - 네이티브 HLS: Safari
 */
export default function CameraStream({ camera, compact = false }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // API 응답의 hls_url 사용 (없으면 직접 생성)
  const hlsUrl = camera.hls_url
    ?? `/hls/${camera.ip}/${camera.hls_port ?? 8888}/${camera.path}/index.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 기존 hls 인스턴스 정리
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari 네이티브 HLS
      video.src = hlsUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, camera.status, camera.enabled]);

  if (!camera.enabled || camera.status === "offline") {
    return (
      <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ fontSize: compact ? 24 : 40, opacity: 0.15 }}>◼</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: compact ? 9 : 11, color: camera.enabled ? COLORS.offline : COLORS.disabled, letterSpacing: 2, textTransform: "uppercase" }}>
          {camera.enabled ? "OFFLINE" : "DISABLED"}
        </div>
        {!compact && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.disabled, marginTop: 4 }}>
            {hlsUrl}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: COLORS.bg }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        mixBlendMode: "multiply",
      }} />
    </div>
  );
}
