export type Round = "ROUND1" | "ROUND2" | "ROUND3" | "ROUND4";

export type Phase =
  | "IDLE"
  | "ROUND_READY"
  | "QUESTION_SHOW"
  | "TIMER_RUNNING"
  | "JUDGING"
  | "REVEAL"
  | "TRANSITION"
  | "ROUND_END";

export type QuestionResult = "CORRECT" | "WRONG" | "TIMEOUT" | "NO_ANSWER";

export type PackageStatus = "unassigned" | "in_progress" | "completed";

export interface QuestionTimer {
  endsAt: number; // epoch milliseconds
  running: boolean;
}

export interface TeamScore {
  teamId: string;
  nameSnapshot: string;
  score: number;
  status: "active" | "waiting" | "finished";
}

export interface GameState {
  round: Round;
  phase: Phase;
  activeTeamId?: string;
  activePackageId?: string;
  currentQuestionId?: string;
  questionTimer?: QuestionTimer;
  teams: TeamScore[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PackageHistory {
  index: number;
  questionId: string;
  result: QuestionResult;
  judgedBy?: string;
  judgedAt: Date;
}

