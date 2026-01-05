"use client";

import { round2Colors, round2Spacing, round2Gradients } from "./round2Styles";

interface LiveViewProps {
  streamUrl?: string;
}

export function LiveView({ streamUrl }: LiveViewProps) {
  return (
    <div 
      className="w-full h-full relative overflow-hidden"
      style={{
        background: round2Gradients.navyBackground,
        border: `${round2Spacing.borderWidth} solid ${round2Colors.cyanBorder}40`,
      }}
    >
      {streamUrl ? (
        <iframe
          src={streamUrl}
          className="w-full h-full"
          allow="camera; microphone"
          allowFullScreen
          style={{ border: "none" }}
        />
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${round2Colors.navyDark} 0%, ${round2Colors.navyMid} 50%, ${round2Colors.navyDark} 100%)`,
          }}
        >
          <div className="text-center">
            <div 
              className="mb-4"
              style={{
                fontSize: "3rem",
                color: `${round2Colors.cyanBorder}40`,
              }}
            >
              📹
            </div>
            <p 
              className="mb-2"
              style={{
                color: round2Colors.textGray,
                fontSize: "1.125rem",
              }}
            >
              Live View
            </p>
            <p 
              style={{
                color: `${round2Colors.textGray}80`,
                fontSize: "0.875rem",
              }}
            >
              Camera feed sẽ hiển thị ở đây
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
