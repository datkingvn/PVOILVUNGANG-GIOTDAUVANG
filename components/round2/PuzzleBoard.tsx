"use client";

import type { Round2Image, Phase } from "@/types/game";
import { round2Colors, round2Typography, round2Gradients, round2Spacing, round2Effects } from "./round2Styles";

interface PuzzleBoardProps {
  image?: Round2Image;
  revealedPieces?: { [pieceIndex: number]: boolean } | Map<string, boolean>;
  phase?: Phase;
}

export function PuzzleBoard({
  image,
  revealedPieces = {},
  phase,
}: PuzzleBoardProps) {
  const pieces = image?.pieces || [];
  
  // Handle both object and Map types for revealedPieces
  // After toObject({ flattenMaps: true }), Map becomes object with string keys
  const isRevealed = (index: number): boolean => {
    if (!revealedPieces) return false;
    
    if (revealedPieces instanceof Map) {
      return revealedPieces.get(index.toString()) === true;
    }
    
    // Handle object - check string key (after toObject, Map keys become strings)
    const stringKey = index.toString();
    return (revealedPieces as { [key: string]: boolean })[stringKey] === true;
  };

  const getPieceUrl = (index: number): string | undefined => {
    return pieces.find((p) => p.index === index)?.url;
  };

  // Chỉ hiển thị full image ở phase FINAL_PIECE_REVEAL (sau khi đoán CNV xong),
  // còn phase REVEAL_PIECE chỉ dùng để mở dần từng mảnh theo hàng ngang
  const showFullImage = phase === "FINAL_PIECE_REVEAL" && image?.originalUrl;

  // Tính aspect ratio theo ảnh gốc để khung puzzle luôn giữ đúng tỉ lệ
  const aspectRatio =
    image && image.dimensions
      ? image.dimensions.width / image.dimensions.height
      : 16 / 9;

  return (
    <div
      className="relative w-full"
      style={{
        background: round2Gradients.navyBackground,
        border: `${round2Spacing.borderWidth} solid ${round2Colors.cyanBorder}40`,
        aspectRatio,
      }}
    >
      {/* Full image overlay when phase is REVEAL_PIECE */}
      {showFullImage && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: round2Gradients.navyBackground,
            animation: "fadeIn 0.5s ease-in",
          }}
        >
          <img
            src={image.originalUrl}
            alt="Full puzzle image"
            className="w-full h-full object-contain"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          />
        </div>
      )}

      {/* Puzzle pieces grid - hidden when showing full image */}
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full ${showFullImage ? "opacity-0" : ""}`}>
        {/* Piece 1: Top-left */}
        <div className="relative border-r border-b border-cyan-500/20">
          {isRevealed(1) && getPieceUrl(1) ? (
            <img
              src={getPieceUrl(1)}
              alt="Piece 1"
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: round2Gradients.navyPiece,
              }}
            >
              <span 
                className="text-white font-bold"
                style={{
                  fontSize: round2Typography.pieceNumber.fontSize,
                  fontWeight: round2Typography.pieceNumber.fontWeight,
                  opacity: round2Typography.pieceNumber.opacity,
                }}
              >
                1
              </span>
            </div>
          )}
        </div>

        {/* Piece 2: Top-right */}
        <div className="relative border-l border-b border-cyan-500/20">
          {isRevealed(2) && getPieceUrl(2) ? (
            <img
              src={getPieceUrl(2)}
              alt="Piece 2"
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: round2Gradients.navyPiece,
              }}
            >
              <span 
                className="text-white font-bold"
                style={{
                  fontSize: round2Typography.pieceNumber.fontSize,
                  fontWeight: round2Typography.pieceNumber.fontWeight,
                  opacity: round2Typography.pieceNumber.opacity,
                }}
              >
                2
              </span>
            </div>
          )}
        </div>

        {/* Piece 4: Bottom-left */}
        <div className="relative border-r border-t border-cyan-500/20">
          {isRevealed(4) && getPieceUrl(4) ? (
            <img
              src={getPieceUrl(4)}
              alt="Piece 4"
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: round2Gradients.navyPiece,
              }}
            >
              <span 
                className="text-white font-bold"
                style={{
                  fontSize: round2Typography.pieceNumber.fontSize,
                  fontWeight: round2Typography.pieceNumber.fontWeight,
                  opacity: round2Typography.pieceNumber.opacity,
                }}
              >
                4
              </span>
            </div>
          )}
        </div>

        {/* Piece 3: Bottom-right */}
        <div className="relative border-l border-t border-cyan-500/20">
          {isRevealed(3) && getPieceUrl(3) ? (
            <img
              src={getPieceUrl(3)}
              alt="Piece 3"
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                background: round2Gradients.navyPiece,
              }}
            >
              <span 
                className="text-white font-bold"
                style={{
                  fontSize: round2Typography.pieceNumber.fontSize,
                  fontWeight: round2Typography.pieceNumber.fontWeight,
                  opacity: round2Typography.pieceNumber.opacity,
                }}
              >
                3
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Central rectangle to cover the intersection of pieces */}
      {!showFullImage && (
        <div
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "40%",
            height: "40%",
            background: round2Gradients.navyPiece,
            border: `${round2Spacing.borderWidth} solid ${round2Colors.cyanBorder}40`,
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
