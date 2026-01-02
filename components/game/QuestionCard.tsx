"use client";

import { useEffect, useMemo, useState } from "react";

interface QuestionCardProps {
  questionText?: string;
  questionNumber?: number;
  totalQuestions?: number;
  packageNumber?: number;
}

export function QuestionCard({
  questionText,
  questionNumber,
  totalQuestions,
  packageNumber,
}: QuestionCardProps) {
  const [fontSize, setFontSize] = useState("text-2xl");

  useEffect(() => {
    if (!questionText) return;
    const length = questionText.trim().length;

    if (length < 60) setFontSize("text-3xl md:text-4xl");
    else if (length < 110) setFontSize("text-2xl md:text-3xl");
    else if (length < 170) setFontSize("text-xl md:text-2xl");
    else setFontSize("text-lg md:text-xl");
  }, [questionText]);

  const clipPath = useMemo(
    () =>
      "polygon(" +
      "2.8% 0%," +
      "97.2% 0%," +
      "100% 12%," +
      "100% 88%," +
      "97.2% 100%," +
      "2.8% 100%," +
      "0% 88%," +
      "0% 12%" +
      ")",
    []
  );

  return (
    <div className="relative w-full" style={{ minHeight: 220 }}>
      <div
        className="absolute inset-0"
        style={{
          clipPath,
          filter: "blur(14px)",
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.35), rgba(59,130,246,0.18), transparent 70%)",
          transform: "scale(1.01)",
          opacity: 0.9,
        }}
      />

      <div
        className="relative w-full h-full p-[6px]"
        style={{
          clipPath,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.35))",
          boxShadow:
            "0 14px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        <div
          className="relative w-full h-full p-8 md:p-10"
          style={{
            clipPath,
            background:
              "linear-gradient(180deg, #0b2a5a 0%, #0a2350 45%, #071a3f 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -10px 30px rgba(0,0,0,0.35)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 28%, transparent 60%)",
            }}
          />

          <div className="relative z-10">
            {packageNumber != null &&
              questionNumber != null &&
              totalQuestions != null && (
                <div className="text-sm md:text-base text-white/80 mb-4">
                  Gói {packageNumber} • Câu {questionNumber}/{totalQuestions}
                </div>
              )}

            {questionText ? (
              <div
                className={`${fontSize} font-semibold text-white leading-relaxed`}
                style={{
                  textShadow:
                    "0 2px 10px rgba(0,0,0,0.45), 0 0 24px rgba(255,255,255,0.08)",
                }}
              >
                {questionText}
              </div>
            ) : (
              <div className="text-xl md:text-2xl text-white/70 text-center py-10">
                Chưa có câu hỏi
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

