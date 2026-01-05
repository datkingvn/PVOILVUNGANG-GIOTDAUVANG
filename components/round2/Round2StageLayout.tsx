"use client";

import { ReactNode } from "react";
import { round2Colors, round2Spacing, round2Gradients } from "./round2Styles";
import type { Phase, Round2Meta } from "@/types/game";

interface Round2StageLayoutProps {
  puzzleBoard: ReactNode;
  cnvPanel: ReactNode;
  questionPanel: ReactNode;
  liveView: ReactNode;
  phase?: Phase;
  round2Meta?: Round2Meta;
  teams?: Array<{ teamId: string; nameSnapshot: string }>;
}

export function Round2StageLayout({
  puzzleBoard,
  cnvPanel,
  questionPanel,
  liveView,
  phase,
  round2Meta,
  teams = [],
}: Round2StageLayoutProps) {
  const keywordWinnerTeamId = round2Meta?.buzzState?.keywordWinnerTeamId;
  const showCompletionMessage = phase === "ROUND_END" && keywordWinnerTeamId;
  const winnerTeam = teams.find((t) => t.teamId === keywordWinnerTeamId);

  return (
    <div
      className="w-full flex items-center justify-center p-4"
      style={{
        minHeight: "100vh",
        background: round2Gradients.navyBackground,
      }}
    >
      {/* Outer container with 16:9 aspect ratio */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "16/9",
          maxWidth: "100%",
          maxHeight: "100vh",
        }}
      >
        {/* Outer TV frame border */}
        <div
          className="w-full h-full relative overflow-hidden"
          style={{
            border: `${round2Spacing.outerBorderWidth} solid ${round2Colors.cyanBorder}`,
            borderRadius: "4px",
            background: round2Gradients.navyBackground,
            boxShadow: `0 0 30px ${round2Colors.cyanGlow}, inset 0 0 20px ${round2Colors.navyDark}`,
          }}
        >
          {/* Main grid container: 2 rows × 2 cols */}
          <div
            className="w-full h-full grid"
            style={{
              gridTemplateColumns: "52% 48%",
              gridTemplateRows: "52% 48%",
              gap: round2Spacing.gridGap,
              padding: round2Spacing.gridGap,
            }}
          >
            {/* TOP-LEFT: Puzzle Board */}
            <div className="w-full h-full relative">
              {puzzleBoard}
            </div>

            {/* TOP-RIGHT: CNV Panel */}
            <div className="w-full h-full relative">
              {cnvPanel}
            </div>

            {/* BOTTOM-LEFT: Question Panel */}
            <div className="w-full h-full relative">
              {questionPanel}
            </div>

            {/* BOTTOM-RIGHT: Live View */}
            <div className="w-full h-full relative">
              {liveView}
            </div>
          </div>

          {/* Completion Message Overlay */}
          {showCompletionMessage && winnerTeam && (
            <div
              className="absolute inset-0 flex items-center justify-center z-50"
              style={{
                background: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="text-center p-8 rounded-lg border-2"
                style={{
                  background: round2Gradients.navyBackground,
                  borderColor: round2Colors.cyanBorder,
                  boxShadow: `0 0 40px ${round2Colors.cyanGlow}`,
                  maxWidth: "80%",
                }}
              >
                <h2
                  className="text-4xl font-bold mb-4"
                  style={{
                    color: round2Colors.cyanBright,
                    textShadow: `0 0 20px ${round2Colors.cyanGlow}`,
                  }}
                >
                  HOÀN THÀNH PHẦN THI THỨ 2
                </h2>
                <p
                  className="text-3xl font-semibold"
                  style={{
                    color: round2Colors.textWhite,
                  }}
                >
                  <span style={{ color: round2Colors.cyanBright }}>{winnerTeam.nameSnapshot}</span> đoán đúng từ khóa
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

