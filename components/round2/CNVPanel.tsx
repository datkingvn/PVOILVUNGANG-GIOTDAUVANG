"use client";

import type { Round2Meta } from "@/types/game";
import { countLetters } from "@/lib/utils/round2-engine";

interface CNVPanelProps {
  round2Meta?: Round2Meta;
  cnvInput?: string; // Current CNV answer being typed
  horizontalAnswers?: Array<{
    order: number;
    answer: string;   // đáp án thật (để tính số chữ & khi revealed thì hiện chữ)
    answered: boolean;
    rejected?: boolean; // MC không nhận kết quả (result === "WRONG")
  }>;
}

type BubbleTone = "hidden" | "active" | "revealed" | "rejected";

export function CNVPanel({
  round2Meta,
  cnvInput = "",
  horizontalAnswers = [],
}: CNVPanelProps) {
  const cnvLetterCount = round2Meta?.cnvLetterCount || 0;

  // revealedPieces can be Map or object
  const revealedPieces: any = round2Meta?.revealedPieces || {};
  const isPieceRevealed = (index: number): boolean => {
    if (!revealedPieces) return false;
    if (revealedPieces instanceof Map) {
      return revealedPieces.get(String(index)) === true || revealedPieces.get(index) === true;
    }
    return revealedPieces[String(index)] === true || revealedPieces[index] === true;
  };

  // ====== UI constants (match screenshot) ======
  const CH = 18; // chamfer size

  const frameClip = `polygon(
    ${CH}px 0,
    calc(100% - ${CH}px) 0,
    100% ${CH}px,
    100% calc(100% - ${CH}px),
    calc(100% - ${CH}px) 100%,
    ${CH}px 100%,
    0 calc(100% - ${CH}px),
    0 ${CH}px
  )`;

  const headerClip = `polygon(
    ${CH}px 0,
    calc(100% - ${CH}px) 0,
    100% ${CH}px,
    calc(100% - ${CH}px) 100%,
    ${CH}px 100%,
    0 ${CH}px
  )`;

  const ui = {
    bg: "linear-gradient(90deg, #0e1f4a 0%, #0f2d6a 55%, #123a88 100%)",
    frameBorder: "rgba(120, 200, 245, 0.35)",
    frameInner: "rgba(0,0,0,0.25)",
    headerBg: "linear-gradient(180deg, #c9f7ff 0%, #5fc3f2 55%, #1e79b6 100%)",
    headerBorder: "rgba(15, 65, 120, 0.85)",

    // bubble ring + inner discs
    ring: "linear-gradient(180deg, rgba(240,250,255,0.95) 0%, rgba(140,175,210,0.95) 55%, rgba(70,95,125,0.98) 100%)",
    discHidden:
      "radial-gradient(circle at 30% 25%, rgba(170,205,255,0.85) 0%, rgba(60,120,210,0.85) 38%, rgba(13,46,103,0.95) 75%, rgba(8,22,55,1) 100%)",
    discActive:
      "radial-gradient(circle at 30% 25%, rgba(245,255,255,1) 0%, rgba(185,245,255,0.98) 26%, rgba(70,195,235,0.95) 58%, rgba(10,90,145,1) 100%)",
    discRevealed:
      "radial-gradient(circle at 30% 25%, rgba(245,255,255,1) 0%, rgba(200,250,255,0.98) 24%, rgba(95,210,245,0.95) 55%, rgba(10,95,150,1) 100%)",
    discRejected:
      "radial-gradient(circle at 30% 25%, rgba(180,190,200,0.95) 0%, rgba(120,130,140,0.95) 38%, rgba(70,75,85,0.98) 75%, rgba(40,45,55,1) 100%)",

    textDark: "#071a3d",
    textWhite: "#ffffff",

    indicatorOff:
      "linear-gradient(180deg, rgba(95,120,190,0.75) 0%, rgba(55,80,150,0.75) 45%, rgba(35,55,110,0.85) 100%)",
    indicatorOn:
      "linear-gradient(180deg, rgba(170,245,255,0.8) 0%, rgba(95,210,245,0.65) 45%, rgba(30,125,180,0.75) 100%)",
  };

  const stripAnswer = (s: string) => (s || "").replace(/[^0-9A-Za-zÀ-ỹ]/g, "");

  const bubbleSize = 46;      // overall size like screenshot
  const ringPad = 3;         // metallic ring thickness
  const gap = 12;            // spacing between bubbles

  const Bubble = ({
    letter,
    tone,
    showLetter,
  }: {
    letter?: string;
    tone: BubbleTone;
    showLetter?: boolean;
  }) => {
    const discBg =
      tone === "revealed"
        ? ui.discRevealed
        : tone === "active"
          ? ui.discActive
          : tone === "rejected"
            ? ui.discRejected
            : ui.discHidden;

    const hasLetter = !!letter;

    return (
      <div
        style={{
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: 9999,
          background: ui.ring,
          padding: ringPad,
          boxShadow:
            "0 4px 10px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.25)",
          flex: "0 0 auto",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            position: "relative",
            overflow: "hidden",
            background: discBg,
            boxShadow:
              "inset 0 6px 10px rgba(0,0,0,0.35), inset 0 -2px 6px rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* top-left gloss */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.18) 22%, rgba(255,255,255,0) 55%)",
              pointerEvents: "none",
            }}
          />
          {/* subtle rim highlight */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
              borderRadius: 9999,
              pointerEvents: "none",
            }}
          />

          {showLetter && hasLetter ? (
            <span
              style={{
                position: "relative",
                zIndex: 1,
                fontWeight: 900,
                fontSize: "1.3rem",
                letterSpacing: "0.5px",
                color: ui.textDark, // like screenshot (dark letters on cyan disc)
                textTransform: "uppercase",
                textShadow: "0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {letter.toUpperCase()}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const getLetterCount = (answer: string): number => countLetters(answer);

  const renderWordRow = (answer: string, answered: boolean, rejected: boolean = false) => {
    const clean = stripAnswer(answer);
    const totalLetters = getLetterCount(answer);
    const letters = clean.split("");

    const tone: BubbleTone = rejected ? "rejected" : answered ? "revealed" : "hidden";

    return (
      <div
        className="flex items-center"
        style={{
          gap,
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {Array.from({ length: totalLetters }).map((_, i) => (
          <Bubble
            key={i}
            tone={tone}
            letter={letters[i] || ""}
            showLetter={answered}
          />
        ))}
      </div>
    );
  };

  // CNV input: giống ảnh -> chỉ hiện số bubble đúng bằng số chữ đang gõ (tối đa cnvLetterCount)
  const renderCNVInput = (input: string) => {
    const clean = stripAnswer(input);
    const letters = clean.split("").slice(0, cnvLetterCount);

    if (letters.length === 0) return null;

    return (
      <div className="flex items-center" style={{ gap, marginTop: 10 }}>
        {letters.map((ch, i) => (
          <Bubble key={i} tone="revealed" letter={ch} showLetter />
        ))}
      </div>
    );
  };

  const Indicator = ({ num }: { num: number }) => {
    const on = isPieceRevealed(num);

    return (
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 12,
          background: on ? ui.indicatorOn : ui.indicatorOff,
          border: "2px solid rgba(10,35,70,0.85)",
          boxShadow:
            "0 8px 16px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -3px 0 rgba(0,0,0,0.35)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ui.textWhite,
          fontWeight: 900,
          fontSize: "1.55rem",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)",
            pointerEvents: "none",
          }}
        />
        <span style={{ position: "relative", zIndex: 1 }}>{num}</span>
      </div>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: ui.bg,
        clipPath: frameClip,
        border: `2px solid ${ui.frameBorder}`,
        boxShadow: `inset 0 0 0 2px ${ui.frameInner}`,
        overflow: "hidden",
      }}
    >
      {/* Header (inset banner like screenshot) */}
      <div style={{ padding: 12, paddingBottom: 8 }}>
        <div
          style={{
            background: ui.headerBg,
            clipPath: headerClip,
            border: `2px solid ${ui.headerBorder}`,
            boxShadow:
              "0 6px 14px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.25)",
            padding: "10px 16px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontWeight: 900,
              letterSpacing: "0.06em",
              color: "#ffffff",
              fontSize: "1.55rem",
              textTransform: "uppercase",
              textShadow: "0 2px 0 rgba(0,0,0,0.2)",
              lineHeight: 1.1,
            }}
          >
            CHƯỚNG NGẠI VẬT CÓ {cnvLetterCount} CHỮ CÁI
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1"
        style={{
          display: "flex",
          gap: 18,
          padding: "16px 18px 18px 18px",
          minHeight: 0,
        }}
      >
        {/* Left bubbles */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {horizontalAnswers.map((h) => {
            return (
              <div key={h.order}>
                {renderWordRow(h.answer, h.answered, h.rejected || false)}
              </div>
            );
          })}

          {/* CNV input at bottom-left */}
          <div style={{ marginTop: "auto" }}>{renderCNVInput(cnvInput)}</div>
        </div>

        {/* Right indicators */}
        <div
          style={{
            width: 72,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 14,
            paddingTop: 6,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <Indicator key={n} num={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
