"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Phase, PendingAnswer } from "@/types/game";

interface AnswersResultProps {
  phase?: Phase;
  pendingAnswers?: PendingAnswer[];
  currentQuestionId?: string;
  teams?: Array<{ teamId: string; nameSnapshot: string }>;
  packageHistory?: Array<{
    questionId: string;
    result: "CORRECT" | "WRONG";
    judgedAt: Date;
  }>;
}

interface TeamAnswer {
  teamId: string;
  teamName: string;
  answer: string;
  result?: "CORRECT" | "WRONG";
}

export function AnswersResult({
  phase,
  pendingAnswers = [],
  currentQuestionId,
  teams = [],
  packageHistory = [],
}: AnswersResultProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [uiScale, setUiScale] = useState(1);

  const initialAnswersRef = useRef<PendingAnswer[]>([]);
  const cachedQuestionIdRef = useRef<string | undefined>(undefined);
  const previousQuestionIdRef = useRef<string | undefined>(undefined);
  const timeoutsRef = useRef<number[]>([]);

  const shouldShow = phase === "REVEAL_PIECE" || phase === "TURN_SELECT";

  useEffect(() => {
    if (!rootRef.current) return;

    const el = rootRef.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;

      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setBox({ w, h });

      // target layout đẹp nhất quanh 1400x820
      const s = Math.min(1, w / 1400, h / 820);
      const clamped = Math.max(0.62, Math.min(1, s));
      setUiScale(clamped);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (currentQuestionId && currentQuestionId !== previousQuestionIdRef.current) {
      initialAnswersRef.current = [];
      cachedQuestionIdRef.current = currentQuestionId;
      previousQuestionIdRef.current = currentQuestionId;
    }
    if (currentQuestionId && !cachedQuestionIdRef.current) {
      cachedQuestionIdRef.current = currentQuestionId;
    }

    if (pendingAnswers.length > 0) {
      if (initialAnswersRef.current.length === 0) {
        initialAnswersRef.current = [...pendingAnswers];
      } else {
        const existingIds = new Set(initialAnswersRef.current.map((pa) => pa.teamId));
        const newOnes = pendingAnswers.filter((pa) => !existingIds.has(pa.teamId));
        if (newOnes.length) initialAnswersRef.current = [...initialAnswersRef.current, ...newOnes];

        pendingAnswers.forEach((pa) => {
          const idx = initialAnswersRef.current.findIndex((x) => x.teamId === pa.teamId);
          if (idx >= 0) initialAnswersRef.current[idx] = pa;
        });
      }
    }
  }, [currentQuestionId, pendingAnswers, phase]);

  const teamAnswers: TeamAnswer[] = useMemo(() => {
    if (!shouldShow) return [];

    const qid = currentQuestionId || cachedQuestionIdRef.current;
    const allAnswers = initialAnswersRef.current;
    if (!allAnswers.length) return [];

    const historyEntries = qid
      ? packageHistory
          .filter((h) => h.questionId === qid)
          .sort((a, b) => new Date(a.judgedAt).getTime() - new Date(b.judgedAt).getTime())
      : [];

    const answers: TeamAnswer[] = allAnswers
      .map((pa) => {
        const t = teams.find((x) => x.teamId === pa.teamId);
        if (!t) return null;
        return {
          teamId: pa.teamId,
          teamName: t.nameSnapshot,
          answer: pa.answer,
          result: undefined as TeamAnswer["result"],
        };
      })
      .filter(Boolean) as TeamAnswer[];

    answers.sort((a, b) => {
      const aa = allAnswers.find((x) => x.teamId === a.teamId);
      const bb = allAnswers.find((x) => x.teamId === b.teamId);
      return (aa?.submittedAt || 0) - (bb?.submittedAt || 0);
    });

    const currentPendingIds = new Set(pendingAnswers.map((p) => p.teamId));
    let hi = 0;
    answers.forEach((a) => {
      if (!currentPendingIds.has(a.teamId) && hi < historyEntries.length) {
        a.result = historyEntries[hi].result;
        hi++;
      }
    });

    return answers;
  }, [shouldShow, currentQuestionId, pendingAnswers, teams, packageHistory]);

  useEffect(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];

    if (!shouldShow || teamAnswers.length === 0) {
      setVisibleItems(new Set());
      return;
    }

    setVisibleItems(new Set());
    const next = new Set<string>();
    let delay = 0;

    for (const item of teamAnswers) {
      const id = window.setTimeout(() => {
        next.add(item.teamId);
        setVisibleItems(new Set(next));
      }, delay);
      timeoutsRef.current.push(id);
      delay += 220;
    }

    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [shouldShow, teamAnswers]);

  const slots = useMemo(() => {
    const n = teamAnswers.length;
    if (n === 0) return [];

    const baseCardH = 148;
    const cardH = baseCardH * uiScale;

    const safeTopBottom = cardH / 2 + 26 * uiScale;
    const H = Math.max(1, box.h || 1);

    const usable = Math.max(0, H - safeTopBottom * 2);
    const step = n === 1 ? 0 : usable / (n - 1);

    return teamAnswers.map((a, i) => {
      const y = safeTopBottom + step * i;
      const side: "right" | "left" = i % 2 === 0 ? "right" : "left";
      return { ...a, y, side, orderIndex: i };
    });
  }, [teamAnswers, box.h, uiScale]);

  if (!shouldShow || teamAnswers.length === 0) {
    return (
      <div ref={rootRef} className="arRoot">
        <div className="arBg" />
        <div className="arCenterText">Kết quả sẽ hiển thị sau khi chấm xong</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="arRoot" style={{ ["--uiScale" as any]: uiScale }}>
      <div className="arBg" />
      <div className="axis" />

      {slots.map((s) => {
        const isVisible = visibleItems.has(s.teamId);
        const glow =
          s.result === "CORRECT"
            ? "glowCorrect"
            : s.result === "WRONG"
              ? "glowWrong"
              : "glowNeutral";

        return (
          <div key={s.teamId}>
            <div className={`node ${isVisible ? "nodeShow" : ""}`} style={{ top: s.y }} />
            <div className={`dots ${s.side} ${isVisible ? "dotsShow" : ""}`} style={{ top: s.y }} />

            <div className={`slot ${s.side} ${isVisible ? "slotShow" : ""}`} style={{ top: s.y }}>
              <div className={`card ${s.side} ${glow}`}>
                <div className={`tag ${s.side}`}>
                  <span className="tagText">{s.teamName}</span>
                </div>

                <div className={`answer ${s.side}`}>{String(s.answer || "").trim() || "—"}</div>

                {s.result && (
                  <div className={`resultPip ${s.result === "CORRECT" ? "pipOk" : "pipBad"}`} />
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
.arRoot{
  position:relative;
  width:100%;
  height:100%;
  overflow:hidden;
  border-radius:10px;

  --uiScale: 1;

  --axisW: calc(12px * var(--uiScale));
  --node: calc(22px * var(--uiScale));
  --dotsW: calc(96px * var(--uiScale));
  --dotsH: calc(10px * var(--uiScale));
  --outerPad: calc(18px * var(--uiScale));
  --axisPad: calc(14px * var(--uiScale));
  --dotToCard: calc(14px * var(--uiScale));
  --cardH: calc(115px * var(--uiScale));

  --slotNarrow: calc(18px * var(--uiScale));
}

.arBg{
  position:absolute;
  inset:0;
  background: linear-gradient(135deg, #0a8bbf 0%, #0b62c6 40%, #0a46a9 68%, #06318a 100%);
}
.arBg::before{
  content:"";
  position:absolute;
  inset:0;
  background: radial-gradient(circle, rgba(255,255,255,.18) 0 2px, transparent 3px) 0 0 / 26px 26px;
  opacity:.35;
  mask: linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,.9) 38%, rgba(0,0,0,0) 62%);
}
.arBg::after{
  content:"";
  position:absolute;
  inset:0;
  background: radial-gradient(circle, rgba(0,0,0,.30) 0 2px, transparent 3px) 0 0 / 22px 22px;
  opacity:.25;
  mask: radial-gradient(circle at 85% 80%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 58%);
}

.arCenterText{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  color:rgba(255,255,255,.8);
  font-weight:700;
  letter-spacing:.02em;
  text-shadow:0 2px 10px rgba(0,0,0,.35);
}

/* Axis */
.axis{
  position:absolute;
  top:-6%;
  bottom:-6%;
  left:50%;
  width:var(--axisW);
  transform:translateX(-50%);
  border-radius:999px;
  background: linear-gradient(180deg, #44f1ff 0%, #12bfe1 40%, #0aa6d8 60%, #44f1ff 100%);
  box-shadow: 0 0 0 2px rgba(0,0,0,.15), 0 0 18px rgba(84, 236, 255, .35);
}
.axis::before{
  content:"";
  position:absolute;
  inset:2px 4px;
  border-radius:999px;
  background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.16));
}

/* Node */
.node{
  position:absolute;
  left:50%;
  width:var(--node);
  height:var(--node);
  transform:translate(-50%, -50%) scale(.92);
  border-radius:50%;
  background: radial-gradient(circle at 30% 30%, #86fbff 0%, #2ee8ff 35%, #0aa6d8 75%);
  box-shadow:
    0 0 0 calc(6px * var(--uiScale)) rgba(0,0,0,.12),
    0 calc(10px * var(--uiScale)) calc(18px * var(--uiScale)) rgba(0,0,0,.22);
  opacity:0;
  transition: all .45s cubic-bezier(.2,1.2,.2,1);
}
.nodeShow{
  opacity:1;
  transform:translate(-50%, -50%) scale(1);
}

/* Connector dots */
.dots{
  position:absolute;
  height:var(--dotsH);
  width:var(--dotsW);
  transform:translateY(-50%);
  background: radial-gradient(circle at 6px 50%, rgba(255,255,255,.95) 0 3px, transparent 3.5px) repeat-x;
  background-size:12px var(--dotsH);
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.25));
  opacity:0;
  transition: opacity .35s ease;
}
.dots.right{ left: calc(50% + (var(--axisW) / 2) + var(--axisPad)); }
.dots.left{ right: calc(50% + (var(--axisW) / 2) + var(--axisPad)); }
.dotsShow{ opacity:1; }

.slot{
  position:absolute;
  height:var(--cardH);
  transform:translateY(-50%) translateY(calc(18px * var(--uiScale))) scale(.98);
  opacity:0;
  transition: all .55s cubic-bezier(.2,1.2,.2,1);
  pointer-events:none;
}
.slotShow{
  opacity:1;
  transform:translateY(-50%) translateY(0px) scale(1);
}

.slot.right{
  left: calc(50% + (var(--axisW) / 2) + var(--axisPad) + var(--dotsW) + var(--dotToCard));
  right: calc(var(--outerPad) + var(--slotNarrow));
}
.slot.left{
  right: calc(50% + (var(--axisW) / 2) + var(--axisPad) + var(--dotsW) + var(--dotToCard));
  left: calc(var(--outerPad) + var(--slotNarrow));
}

/* Card */
.card{
  position:absolute;
  inset:0;
  color:#fff;
  background: linear-gradient(90deg, rgba(9,45,110,.92) 0%, rgba(6,28,66,.92) 52%, rgba(8,55,120,.72) 100%);
  box-shadow:
    0 calc(14px * var(--uiScale)) calc(22px * var(--uiScale)) rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.10),
    inset 0 calc(-10px * var(--uiScale)) calc(24px * var(--uiScale)) rgba(0,0,0,.32);
}
.card::before{
  content:"";
  position:absolute;
  inset:0;
  box-shadow: inset 0 0 0 calc(2px * var(--uiScale)) rgba(93, 235, 255, .22);
  pointer-events:none;
}

/* Left: giữ nguyên */
.card.left{
  clip-path: polygon(
    0% 24%,
    8% 0%,
    100% 0%,
    100% 78%,
    92% 100%,
    0% 100%
  );
}

.card.right{
  clip-path: polygon(
    0% 0%,
    92% 0%,
    100% 24%,
    100% 100%,
    8% 100%,
    0% 78%
  );
}

/* Glow */
.glowNeutral::before{ box-shadow: inset 0 0 0 calc(2px * var(--uiScale)) rgba(93, 235, 255, .20); }
.glowCorrect::before{ box-shadow: inset 0 0 0 calc(2px * var(--uiScale)) rgba(93, 235, 255, .34), 0 0 calc(18px * var(--uiScale)) rgba(93,235,255,.18); }
.glowWrong::before{ box-shadow: inset 0 0 0 calc(2px * var(--uiScale)) rgba(255, 85, 85, .28), 0 0 calc(18px * var(--uiScale)) rgba(255,85,85,.12); }

/* Tag */
.tag{
  position:absolute;
  top:0;
  height: calc(40px * var(--uiScale));
  width:44%;
  display:flex;
  align-items:center;
  padding:0 calc(18px * var(--uiScale));
  background: linear-gradient(90deg, #0a55ad 0%, #1cc7d8 100%);
  clip-path: polygon(0 0, 92% 0, 100% 36%, 100% 100%, 0 100%);
  filter: drop-shadow(0 calc(8px * var(--uiScale)) calc(10px * var(--uiScale)) rgba(0,0,0,.22));
}
.tag::after{
  content:"";
  position:absolute;
  right:0;
  top:0;
  width:0;
  height:0;
  border-left: calc(18px * var(--uiScale)) solid transparent;
  border-bottom: calc(18px * var(--uiScale)) solid rgba(255,255,255,.18);
}
.tag::before{
  content:"";
  position:absolute;
  left: calc(-18px * var(--uiScale));
  top:0;
  width:0;
  height:0;
  border-right: calc(18px * var(--uiScale)) solid rgba(0,0,0,.20);
  border-top: calc(18px * var(--uiScale)) solid transparent;
  border-bottom: calc(18px * var(--uiScale)) solid transparent;
  opacity:.55;
}
.tag.left{ right: 18%; }
.tag.right{ left: 18%; }

.tagText{
  font-weight:800;
  font-size: clamp(14px, calc(1.3vw * var(--uiScale)), 20px);
  letter-spacing:.02em;
  text-shadow: 0 2px 0 rgba(0,0,0,.32);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Answer */
.answer{
  position:absolute;
  bottom: calc(22px * var(--uiScale));
  max-width: 84%;
  font-weight: 900;
  letter-spacing: .06em;
  text-transform: uppercase;
  text-shadow:
    0 3px 0 rgba(0,0,0,.35),
    0 10px 26px rgba(0,0,0,.32);
  font-size: clamp(16px, calc(2.4vw * var(--uiScale)), 44px);
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.answer.left{ right: calc(22px * var(--uiScale)); text-align:right; }
.answer.right{ left: calc(22px * var(--uiScale)); text-align:left; }

/* Pip */
.resultPip{
  position:absolute;
  width:calc(10px * var(--uiScale));
  height:calc(10px * var(--uiScale));
  border-radius:50%;
  bottom: calc(18px * var(--uiScale));
  opacity:.7;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
}
.card.left .resultPip{ left: calc(16px * var(--uiScale)); }
.card.right .resultPip{ right: calc(16px * var(--uiScale)); }
.pipOk{ background: rgba(93, 235, 255, .95); }
.pipBad{ background: rgba(255, 85, 85, .95); }

@media (prefers-reduced-motion: reduce){
  .slot, .node, .dots{ transition:none !important; }
}
`;
