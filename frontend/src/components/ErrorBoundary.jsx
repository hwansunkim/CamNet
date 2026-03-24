import { Component } from "react";
import { FONT_MONO, COLORS } from "../styles";

/**
 * N-7: React Error Boundary for graceful error handling.
 * Catches JavaScript errors in child components and displays a fallback UI.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: COLORS.bg, color: COLORS.textPrimary,
        }}>
          <div style={{ fontSize: 40, opacity: 0.3 }}>⚠</div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 14, color: COLORS.offline,
            letterSpacing: 1,
          }}>
            오류가 발생했습니다
          </div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textDark,
            maxWidth: 400, textAlign: "center", lineHeight: 1.6,
          }}>
            {this.state.error?.message || "알 수 없는 오류"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontFamily: FONT_MONO, fontSize: 11, padding: "8px 20px",
              background: COLORS.accent, color: COLORS.bg, border: "none",
              borderRadius: 3, cursor: "pointer", letterSpacing: 1, marginTop: 8,
            }}
          >
            재시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
