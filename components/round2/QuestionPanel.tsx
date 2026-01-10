"use client";

import { useMemo, useState, useEffect } from "react";
import type { QuestionTimer, Phase } from "@/types/game";
import { Bell } from "lucide-react";

interface QuestionPanelProps {
  questionText?: string;
  timer?: QuestionTimer;
  phase: Phase;
  currentTeamName?: string;
  canAnswer?: boolean;
  onSubmit?: (answer: string) => void;
  submitting?: boolean;
  alreadySubmitted?: boolean;
  questionJudged?: "CORRECT" | "WRONG" | null;
  onBuzzKeyword?: () => void;
  canBuzzKeyword?: boolean;
  hasBuzzedKeyword?: boolean;
}

export function QuestionPanel({
  questionText,
  timer,
  phase,
  currentTeamName,
  canAnswer = false,
  onSubmit,
  submitting = false,
  alreadySubmitted = false,
  questionJudged = null,
  onBuzzKeyword,
  canBuzzKeyword = false,
  hasBuzzedKeyword = false,
}: QuestionPanelProps) {
  const [answer, setAnswer] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!timer || !(timer as any).running) return;
    
    let animationFrameId: number;
    const updateTime = () => {
      setCurrentTime(Date.now());
      animationFrameId = requestAnimationFrame(updateTime);
    };
    
    animationFrameId = requestAnimationFrame(updateTime);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [timer]);

  const handleSubmit = () => {
    if (answer.trim() && !submitting && onSubmit) {
      onSubmit(answer.trim());
      setAnswer("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const displayText = useMemo(() => {
    if (questionText) return questionText;
    if (phase === "HORIZONTAL_SELECTED") {
      return "Đã chọn hàng ngang - Chờ MC bắt đầu";
    }
    if (phase === "CNV_ACTIVE" && currentTeamName) {
      return `ĐỘI ${currentTeamName.toUpperCase()} TRẢ LỜI CNV`;
    }
    if (phase === "CNV_LOCKED" && currentTeamName) {
      return `ĐỘI ${currentTeamName.toUpperCase()} ĐÃ BẤM CHUÔNG CNV`;
    }
    return "Chờ câu hỏi...";
  }, [questionText, phase, currentTeamName]);

  const isRunning = !!timer && !!(timer as any).running;

  const timeRemaining = useMemo(() => {
    if (!timer || !isRunning) return null;
    const endsAt = (timer as any).endsAt as number;
    const remaining = Math.max(0, endsAt - currentTime);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return { minutes, seconds, totalMs: remaining };
  }, [timer, isRunning, currentTime]);

  const isTimeUp = useMemo(() => {
    if (!timer || !isRunning) return false;
    const endsAt = (timer as any).endsAt as number;
    return currentTime >= endsAt;
  }, [timer, isRunning, currentTime]);

  const elapsedPercent = useMemo(() => {
    if (!timer || !timeRemaining) return 0;
    const TOTAL_MS = 15000;
    const remaining = Math.max(0, Math.min(TOTAL_MS, timeRemaining.totalMs));
    const elapsed = TOTAL_MS - remaining;
    return Math.max(0, Math.min(100, (elapsed / TOTAL_MS) * 100));
  }, [timer, timeRemaining]);

  // ===== UI (tối + viền bạc mỏng như hình) =====
  const ui = useMemo(() => {
    const OUTER_CUT = 42;
    const MID_CUT = 34;
    const INNER_CUT = 26;

    const outerClip = `polygon(
      0 0,
      calc(100% - ${OUTER_CUT}px) 0,
      100% ${OUTER_CUT}px,
      100% 100%,
      ${OUTER_CUT}px 100%,
      0 calc(100% - ${OUTER_CUT}px)
    )`;

    const midClip = `polygon(
      0 0,
      calc(100% - ${MID_CUT}px) 0,
      100% ${MID_CUT}px,
      100% 100%,
      ${MID_CUT}px 100%,
      0 calc(100% - ${MID_CUT}px)
    )`;

    const innerClip = `polygon(
      0 0,
      calc(100% - ${INNER_CUT}px) 0,
      100% ${INNER_CUT}px,
      100% 100%,
      ${INNER_CUT}px 100%,
      0 calc(100% - ${INNER_CUT}px)
    )`;

    return {
      outerClip,
      midClip,
      innerClip,
      OUTER_CUT,
      MID_CUT,
      INNER_CUT,

      // nền khung ngoài: xanh đậm (để viền bạc nổi lên, không bị xanh neon)
      outerBg:
        "linear-gradient(180deg, rgba(28,88,160,1) 0%, rgba(16,58,124,1) 55%, rgba(10,37,86,1) 100%)",

      // lớp bevel/viền giữa
      midBg:
        "linear-gradient(180deg, rgba(16,73,145,1) 0%, rgba(13,55,118,1) 65%, rgba(10,40,92,1) 100%)",

      // panel trong
      innerBg:
        "radial-gradient(1100px 520px at 18% 40%, rgba(60,140,220,0.22) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(14,54,120,1) 0%, rgba(8,33,84,1) 100%)",

      // viền bạc mỏng (quan trọng)
      silverLine: "rgba(235,242,250,0.85)",
      silverLineSoft: "rgba(235,242,250,0.35)",

      innerStroke: "rgba(30,95,170,0.70)",
      midStroke: "rgba(170,225,255,0.22)",

      topHighlight:
        "linear-gradient(90deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.10) 40%, rgba(255,255,255,0.0) 100%)",
    };
  }, []);

  return (
    <div className="w-full h-full relative select-none">
      {/* ===== OUTER FRAME (viền bạc mỏng + giảm độ dày tổng thể) ===== */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: ui.outerClip,
          background: ui.outerBg,
          // viền bạc rõ hơn
          boxShadow: `
            inset 0 0 0 1.5px ${ui.silverLine},
            inset 0 0 0 3px ${ui.silverLineSoft},
            inset 0 0 18px rgba(0,0,0,0.22)
          `,
        }}
      />

      {/* ===== MID FRAME (giảm inset để "border ngoài" không dày) ===== */}
      <div
        className="absolute"
      style={{
          top: 4,
          left: 4,
          right: 4,
          bottom: 4,
          clipPath: ui.midClip,
          background: ui.midBg,
          boxShadow: `
            inset 0 0 0 1.5px rgba(0,0,0,0.35),
            inset 0 0 0 2.5px rgba(120,198,255,0.12)
          `,
        }}
      />

      {/* ===== INNER PANEL ===== */}
      <div
        className="absolute flex flex-col"
        style={{
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          clipPath: ui.innerClip,
          background: ui.innerBg,
          border: `2.5px solid ${ui.innerStroke}`,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* highlight mảnh trên cùng */}
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{ top: 0, height: 4, background: ui.topHighlight, opacity: 0.9 }}
        />

        {/* viền mảnh trong panel - rõ hơn */}
        <div
          className="pointer-events-none absolute"
          style={{
            inset: 6,
            clipPath: ui.innerClip,
            border: `1.5px solid ${ui.midStroke}`,
            opacity: 0.4,
          }}
        />

        {/* CONTENT */}
        <div className="flex-1" style={{ padding: "22px 26px 70px 26px" }}>
          <p
            style={{
              color: "rgba(255,255,255,0.96)",
              fontSize: "clamp(18px, 2.0vw, 32px)",
              lineHeight: 1.25,
              fontWeight: 800,
              textShadow: "0 2px 0 rgba(0,0,0,0.22)",
              letterSpacing: "0.2px",
            }}
          >
            {displayText}
          </p>

          {(canAnswer || questionJudged || isTimeUp) && (
            <div className="mt-6" style={{ maxWidth: 780 }}>
              {questionJudged ? (
                <div
                  className="flex items-center gap-3"
                  style={{
                    padding: "12px 14px",
                    background:
                      questionJudged === "CORRECT"
                        ? "rgba(34,197,94,0.16)"
                        : "rgba(239,68,68,0.16)",
                    border: `2px solid ${
                      questionJudged === "CORRECT"
                        ? "rgba(170,225,255,0.35)"
                        : "rgba(239,68,68,0.75)"
                    }`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color:
                        questionJudged === "CORRECT"
                          ? "rgba(120,255,210,0.95)"
                          : "rgba(255,120,120,0.95)",
                    }}
                  >
                    {questionJudged === "CORRECT" ? "✓" : "✗"}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: 1,
                      color:
                        questionJudged === "CORRECT"
                          ? "rgba(170,255,230,0.95)"
                          : "rgba(255,170,170,0.95)",
                    }}
                  >
                    {questionJudged === "CORRECT" ? "ĐÚNG" : "SAI"}
                  </span>
                </div>
              ) : isTimeUp ? (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(239,68,68,0.14)",
                    border: "2px solid rgba(239,68,68,0.75)",
                    color: "rgba(255,170,170,0.95)",
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  HẾT THỜI GIAN
                </div>
              ) : alreadySubmitted ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "rgba(34,197,94,0.16)",
                    border: "2px solid rgba(34,197,94,0.5)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: "rgba(120,255,210,0.95)",
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      color: "rgba(170,255,230,0.95)",
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    Đã gửi đáp án thành công! Chờ MC chấm điểm...
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập đáp án"
                    autoFocus
                    disabled={submitting || isTimeUp}
                    className="w-full"
                    style={{
                      padding: "12px 14px",
                      background: "rgba(0,0,0,0.22)",
                      border: "1px solid rgba(170,225,255,0.28)",
                      color: "rgba(255,255,255,0.92)",
                      outline: "none",
                      fontSize: 16,
                    }}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!answer.trim() || submitting || isTimeUp}
                    className="w-full"
                    style={{
                      padding: "12px 14px",
                      background:
                        !answer.trim() || submitting || isTimeUp
                          ? "rgba(0,0,0,0.22)"
                          : "linear-gradient(180deg, rgba(110,205,255,0.95) 0%, rgba(55,160,240,0.95) 100%)",
                      border: "1px solid rgba(170,225,255,0.45)",
                      color: "rgba(255,255,255,0.96)",
                      fontWeight: 900,
                      letterSpacing: 1,
                      cursor:
                        !answer.trim() || submitting || isTimeUp
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        !answer.trim() || submitting || isTimeUp ? 0.55 : 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {submitting ? "Đang gửi..." : "Gửi đáp án"}
                  </button>
                </div>
              )}
            </div>
          )}
      </div>

        {/* PROGRESS */}
        {timeRemaining && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              bottom: 12,
              height: 8,
              paddingLeft: 12,
              paddingRight: 12,
            }}
          >
            <div style={{ position: "relative", width: "100%", height: 6 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(220,220,220,0.85)",
                  borderRadius: 999,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${elapsedPercent}%`,
                  background:
                    "linear-gradient(90deg, rgba(185,28,28,1) 0%, rgba(239,68,68,1) 70%, rgba(252,100,100,1) 100%)",
                  borderRadius: 999,
                  boxShadow: "0 0 10px rgba(239,68,68,0.45)",
                }}
              />
              <div
                className="progress-indicator-pulse"
                style={{
                  position: "absolute",
                  left: `${elapsedPercent}%`,
                  top: "50%",
                  width: 14,
                  height: 14,
                  transform: "translate(-50%, -50%)",
                  background: "rgba(239,68,68,1)",
                  borderRadius: 999,
                  border: "1px solid rgba(120,0,0,0.35)",
                }}
              />
            </div>
        </div>
      )}
      
      {/* Animation for progress indicator pulse */}
      <style jsx>{`
        @keyframes progressPulse {
          0%, 100% {
            box-shadow: 
              0 0 50px rgba(239,68,68,0.6), 
              0 0 16px rgba(239,68,68,0.5),
              0 0 24px rgba(239,68,68,0.3),
              inset 0 1px 0 rgba(255,255,255,0.35);
          }
          50% {
            box-shadow: 
              0 0 16px rgba(239,68,68,0.95), 
              0 0 32px rgba(239,68,68,0.8),
              0 0 48px rgba(239,68,68,0.6),
              inset 0 1px 0 rgba(255,255,255,0.35);
          }
        }
        .progress-indicator-pulse {
          animation: progressPulse 1.2s ease-in-out infinite;
        }
      `}</style>
      </div>

      {/* Buzz Keyword Icon - Top right */}
      {onBuzzKeyword !== undefined && (
        <button
          onClick={onBuzzKeyword}
          disabled={!canBuzzKeyword || hasBuzzedKeyword}
          className="absolute"
          style={{
            top: 8,
            right: 8,
            width: 56,
            height: 56,
            background: hasBuzzedKeyword
              ? "rgba(100,100,100,0.3)"
              : canBuzzKeyword
              ? "linear-gradient(135deg, rgba(255,215,0,0.95) 0%, rgba(255,165,0,0.95) 100%)"
              : "rgba(100,100,100,0.2)",
            border: `2px solid ${
              hasBuzzedKeyword
                ? "rgba(150,150,150,0.5)"
                : canBuzzKeyword
                ? "rgba(255,255,255,0.8)"
                : "rgba(150,150,150,0.3)"
            }`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canBuzzKeyword && !hasBuzzedKeyword ? "pointer" : "not-allowed",
            opacity: canBuzzKeyword && !hasBuzzedKeyword ? 1 : 0.6,
            boxShadow: canBuzzKeyword && !hasBuzzedKeyword
              ? "0 0 20px rgba(255,215,0,0.6), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)"
              : "0 2px 8px rgba(0,0,0,0.2)",
            transform: canBuzzKeyword && !hasBuzzedKeyword ? "scale(1)" : "scale(0.95)",
            transition: "all 0.2s ease",
            zIndex: 10,
            animation: canBuzzKeyword && !hasBuzzedKeyword ? "pulseGlow 2s ease-in-out infinite" : "none",
          }}
          onMouseEnter={(e) => {
            if (canBuzzKeyword && !hasBuzzedKeyword) {
              e.currentTarget.style.transform = "scale(1.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (canBuzzKeyword && !hasBuzzedKeyword) {
              e.currentTarget.style.transform = "scale(1)";
            }
          }}
        >
          <Bell
            size={32}
            strokeWidth={2.5}
            stroke={hasBuzzedKeyword ? "rgba(200,200,200,0.8)" : canBuzzKeyword ? "rgba(255,255,255,0.95)" : "rgba(150,150,150,0.6)"}
            style={{
              filter: canBuzzKeyword && !hasBuzzedKeyword ? "drop-shadow(0 0 4px rgba(255,255,255,0.8))" : "none",
            }}
          />
          <style jsx>{`
            @keyframes pulseGlow {
              0%, 100% {
                box-shadow: 0 0 20px rgba(255,215,0,0.6), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
              }
              50% {
                box-shadow: 0 0 30px rgba(255,215,0,0.9), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
              }
            }
          `}</style>
        </button>
      )}

      {/* Border lines at cut corners - Top right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          right: 0,
          width: `${ui.OUTER_CUT || 42}px`,
          height: `${ui.OUTER_CUT || 42}px`,
          borderTop: `1.5px solid ${ui.silverLine}`,
          borderRight: `1.5px solid ${ui.silverLine}`,
          clipPath: `polygon(0 0, 100% 0, 100% 100%)`,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: 4,
          right: 4,
          width: `${ui.MID_CUT || 34}px`,
          height: `${ui.MID_CUT || 34}px`,
          borderTop: `1.5px solid rgba(120,198,255,0.15)`,
          borderRight: `1.5px solid rgba(120,198,255,0.15)`,
          clipPath: `polygon(0 0, 100% 0, 100% 100%)`,
        }}
      />

      {/* Border lines at cut corners - Bottom left */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0,
          left: 0,
          width: `${ui.OUTER_CUT || 42}px`,
          height: `${ui.OUTER_CUT || 42}px`,
          borderBottom: `1.5px solid ${ui.silverLine}`,
          borderLeft: `1.5px solid ${ui.silverLine}`,
          clipPath: `polygon(0 0, 0 100%, 100% 100%)`,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 4,
          left: 4,
          width: `${ui.MID_CUT || 34}px`,
          height: `${ui.MID_CUT || 34}px`,
          borderBottom: `1.5px solid rgba(120,198,255,0.15)`,
          borderLeft: `1.5px solid rgba(120,198,255,0.15)`,
          clipPath: `polygon(0 0, 0 100%, 100% 100%)`,
        }}
      />
    </div>
  );
}
