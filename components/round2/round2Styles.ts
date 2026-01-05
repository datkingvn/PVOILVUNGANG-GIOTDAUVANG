/**
 * Round 2 Broadcast Style Constants
 * Match Olympia TV broadcast aesthetic
 */

export const round2Colors = {
  // Navy base colors
  navyDark: "#061b3a",
  navyMid: "#07224a",
  navyLight: "#0a2f63",
  
  // Cyan/Blue borders and accents
  cyanBorder: "#35c8ff",
  cyanBorderAlt: "#2dd4ff",
  cyanGlow: "rgba(80, 220, 255, 0.35)",
  cyanBright: "#50dcff",
  
  // Text colors
  textWhite: "#ffffff",
  textCyan: "#35c8ff",
  textGray: "#9ca3af",
  
  // Background overlays
  overlayDark: "rgba(0, 0, 0, 0.4)",
  overlayNavy: "rgba(6, 27, 58, 0.8)",
  
  // Bubble states
  bubbleUnrevealed: "#1e3a5f",
  bubbleRevealed: "#35c8ff",
  bubbleGlow: "rgba(53, 200, 255, 0.5)",
};

export const round2Typography = {
  header: {
    fontSize: "1.5rem",
    fontWeight: "700",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  },
  question: {
    fontSize: "1.25rem",
    lineHeight: "1.6",
    fontWeight: "400",
  },
  timecode: {
    fontSize: "1.125rem",
    fontFamily: "monospace",
    fontWeight: "600",
  },
  pieceNumber: {
    fontSize: "4rem",
    fontWeight: "700",
    opacity: 0.8,
  },
};

export const round2Spacing = {
  gridGap: "10px",
  panelPadding: "16px",
  borderWidth: "2px",
  outerBorderWidth: "8px",
  chamferSize: "4px",
};

export const round2Effects = {
  chamferClip: "polygon(2% 0%, 98% 0%, 100% 3%, 100% 97%, 98% 100%, 2% 100%, 0% 97%, 0% 3%)",
  innerShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2)",
  glow: `0 0 10px ${round2Colors.cyanGlow}, 0 0 20px ${round2Colors.cyanGlow}`,
  bubbleShine: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%)",
};

export const round2Gradients = {
  navyBackground: `linear-gradient(135deg, ${round2Colors.navyDark} 0%, ${round2Colors.navyMid} 50%, ${round2Colors.navyLight} 100%)`,
  navyPiece: `linear-gradient(135deg, ${round2Colors.navyDark} 0%, ${round2Colors.navyMid} 50%, ${round2Colors.navyDark} 100%)`,
  cyanHeader: `linear-gradient(180deg, ${round2Colors.cyanBorder} 0%, ${round2Colors.cyanBorderAlt} 100%)`,
};

