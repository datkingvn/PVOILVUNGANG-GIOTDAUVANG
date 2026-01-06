"use client";

import { Card } from "@/components/ui/card";
import type { PendingAnswer, Round3AnswerResult } from "@/types/game";
import { sortAnswersByTimestamp } from "@/lib/utils/round3-engine";
import { CheckCircle2, XCircle, Clock, Trophy } from "lucide-react";

interface JudgingPanelProps {
  pendingAnswers: PendingAnswer[];
  questionResults: Round3AnswerResult[];
  teams: Array<{ teamId: string; nameSnapshot: string }>;
  onJudge: (teamId: string, isCorrect: boolean) => Promise<void>;
  question?: {
    answerText?: string;
    acceptedAnswers?: string[];
    type?: "reasoning" | "video" | "arrange";
  };
}

export function JudgingPanel({
  pendingAnswers,
  questionResults,
  teams,
  onJudge, // Keep for backward compatibility but not used
  question, // Keep for backward compatibility but not used
}: JudgingPanelProps) {
  // Sort pending answers by timestamp
  const sortedPending = sortAnswersByTimestamp(pendingAnswers);

  // Get team names
  const getTeamName = (teamId: string) => {
    return teams.find((t) => t.teamId === teamId)?.nameSnapshot || teamId;
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}.${String(
      date.getMilliseconds()
    ).padStart(3, "0")}`;
  };

  // Calculate submission order display (1st, 2nd, 3rd, 4th)
  const getOrderLabel = (order: number) => {
    if (order === 0) return "";
    const labels = ["", "1st", "2nd", "3rd", "4th"];
    return labels[order] || `${order}th`;
  };

  // Sort questionResults by submission time for display
  const sortedResults = [...questionResults].sort((a, b) => a.submittedAt - b.submittedAt);

  return (
    <div className="space-y-4">
      {/* Auto-judged Results */}
      {sortedResults.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold mb-4">Kết quả chấm tự động</h3>
          <div className="space-y-3">
            {sortedResults.map((result) => {
              const teamName = getTeamName(result.teamId);
              const timeStr = formatTime(result.submittedAt);
              const orderLabel = getOrderLabel(result.submissionOrder);

              return (
                <div
                  key={result.teamId}
                  className={`p-4 rounded-lg border-2 ${
                    result.isCorrect
                      ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-600/50"
                      : "bg-gradient-to-r from-red-900/30 to-rose-900/30 border-red-600/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {result.isCorrect && result.submissionOrder > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-lg">
                            <Trophy className="w-4 h-4 text-white" />
                            <span className="font-bold text-white">{orderLabel}</span>
                          </div>
                        )}
                        <div className="font-semibold text-white">{teamName}</div>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <Clock className="w-4 h-4" />
                          {timeStr}
                        </div>
                        {result.isCorrect ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-semibold text-sm">Đúng</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-semibold text-sm">Sai</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-11">
                        <div className="text-gray-400 text-xs mb-1">Đáp án:</div>
                        <div className="text-gray-300 font-medium">{result.answer || "N/A"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {result.isCorrect && result.score > 0 && (
                        <div className="text-2xl font-bold text-yellow-400">
                          +{result.score}
                        </div>
                      )}
                      {!result.isCorrect && (
                        <div className="text-lg font-semibold text-gray-400">0 điểm</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pending Answers (if any teams haven't submitted yet) */}
      {pendingAnswers.length > 0 && (
        <Card>
          <h3 className="text-xl font-bold mb-4">Đang chờ submit</h3>
          <div className="space-y-3">
            {sortedPending.map((answer, index) => {
              const teamName = getTeamName(answer.teamId);
              const timeStr = formatTime(answer.submittedAt);

              return (
                <div
                  key={answer.teamId}
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
                          {index + 1}
                        </div>
                        <div className="font-semibold text-white">{teamName}</div>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <Clock className="w-4 h-4" />
                          {timeStr}
                        </div>
                      </div>
                      <div className="ml-11 text-gray-300">{answer.answer}</div>
                    </div>
                    <div className="text-gray-400 text-sm">Đang chờ...</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {sortedResults.length === 0 && pendingAnswers.length === 0 && (
        <Card>
          <div className="text-center py-8 text-gray-400">
            Chưa có đáp án nào được submit
          </div>
        </Card>
      )}
    </div>
  );
}

