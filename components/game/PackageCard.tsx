"use client";

import { useMemo } from "react";

interface PackageCardProps {
  packageNumber: number;
  assignedTeamName?: string;
  isAssigned: boolean;
  isCurrentPackage: boolean;
}

export function PackageCard({
  packageNumber,
  assignedTeamName,
  isAssigned,
  isCurrentPackage,
}: PackageCardProps) {
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

  const outerBg = isCurrentPackage
    ? "linear-gradient(180deg, rgba(190,250,255,1) 0%, rgba(70,210,245,1) 100%)"
    : isAssigned
    ? "linear-gradient(180deg, rgba(140,255,140,1) 0%, rgba(60,200,60,1) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.35))";

  const innerBg = isCurrentPackage
    ? "linear-gradient(180deg, #0c4a6e 0%, #083344 45%, #042f2e 100%)"
    : isAssigned
    ? "linear-gradient(180deg, #166534 0%, #0f4d28 45%, #0a3b1e 100%)"
    : "linear-gradient(180deg, #0b2a5a 0%, #0a2350 45%, #071a3f 100%)";

  const textColor = isCurrentPackage
    ? "text-cyan-300"
    : isAssigned
    ? "text-green-300"
    : "text-gray-400";

  const statusTextColor = isCurrentPackage
    ? "text-cyan-200"
    : isAssigned
    ? "text-green-200"
    : "text-gray-500";

  return (
    <div className="relative w-full" style={{ minHeight: 120 }}>
      <div
        className="absolute inset-0"
        style={{
          clipPath,
          filter: "blur(8px)",
          background: isCurrentPackage
            ? "radial-gradient(ellipse at 50% 20%, rgba(6,182,212,0.4), rgba(14,165,233,0.2), transparent 70%)"
            : isAssigned
            ? "radial-gradient(ellipse at 50% 20%, rgba(34,197,94,0.4), rgba(21,128,61,0.2), transparent 70%)"
            : "radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.35), rgba(59,130,246,0.18), transparent 70%)",
          transform: "scale(1.01)",
          opacity: 0.8,
        }}
      />

      <div
        className="relative w-full h-full p-[4px]"
        style={{
          clipPath,
          background: outerBg,
          boxShadow:
            "0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="relative w-full h-full p-4 flex flex-col items-center justify-center"
          style={{
            clipPath,
            background: innerBg,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -6px 18px rgba(0,0,0,0.25)",
          }}
        >
          <div className="relative z-10 text-center">
            <div className={`font-bold text-xl mb-1 ${textColor}`}>
              Gói {packageNumber}
            </div>
            {isAssigned && assignedTeamName ? (
              <div className={`text-xs ${statusTextColor}`}>
                {assignedTeamName} chọn
              </div>
            ) : (
              <div className={`text-xs ${statusTextColor}`}>Chưa chọn</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

