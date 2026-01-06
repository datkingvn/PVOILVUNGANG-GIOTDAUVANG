export type Round = "ROUND1" | "ROUND2" | "ROUND3" | "ROUND4";

export type Phase =
  | "IDLE"
  | "ROUND_READY"
  | "QUESTION_SHOW"
  | "TIMER_RUNNING"
  | "JUDGING"
  | "REVEAL"
  | "TRANSITION"
  | "ROUND_END"
  // Round 2 phases
  | "SETUP"
  | "TURN_SELECT"
  | "HORIZONTAL_ACTIVE"
  | "HORIZONTAL_JUDGING"
  | "REVEAL_PIECE"
  | "CNV_LOCKED"
  | "CNV_ACTIVE"
  | "CNV_JUDGING"
  | "FINAL_PIECE_REVEAL"
  | "CENTER_HINT_ACTIVE"
  | "KEYWORD_BUZZ_JUDGING"
  // Round 3 phases
  | "ROUND3_READY"
  | "ROUND3_QUESTION_ACTIVE"
  | "ROUND3_JUDGING"
  | "ROUND3_RESULTS"
  | "ROUND3_END"
  // Round 4 phases
  | "R4_IDLE"
  | "R4_TURN_SELECT_PACKAGE"
  | "R4_TURN_PICK_QUESTIONS"
  | "R4_STAR_CONFIRMATION"
  | "R4_QUESTION_SHOW"
  | "R4_QUESTION_LOCK_MAIN"
  | "R4_JUDGE_MAIN"
  | "R4_STEAL_WINDOW"
  | "R4_STEAL_LOCKED"
  | "R4_JUDGE_STEAL"
  | "R4_NEXT_QUESTION"
  | "R4_NEXT_TEAM"
  | "R4_END";

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


export interface PackageHistory {
  index: number;
  questionId: string;
  result: QuestionResult;
  judgedBy?: string;
  judgedAt: Date;
}

// Round 2 specific types
export interface Round2ImagePiece {
  index: 1 | 2 | 3 | 4;
  url: string;
}

export interface Round2Image {
  originalUrl: string;
  pieces: Round2ImagePiece[];
  dimensions: {
    width: number;
    height: number;
  };
}

export interface Round2Mapping {
  horizontalOrder: number;
  pieceIndex: number;
}

export interface Round2TurnState {
  currentTeamId?: string;
  teamsUsedHorizontalAttempt: { [teamId: string]: boolean };
}

export interface Round2BuzzState {
  cnvLockTeamId?: string;
  cnvLockEndsAt?: number;
  keywordBuzzQueue?: Array<{
    teamId: string;
    buzzedAt: number; // timestamp
  }>;
  currentKeywordBuzzIndex?: number; // index đội đang được chấm
  keywordWinnerTeamId?: string; // đội đoán đúng từ khóa (để hiển thị message)
}

export interface Round2Meta {
  cnvAnswer: string;
  cnvLetterCount: number;
  image: Round2Image;
  mapping: Round2Mapping[];
  finalPieceIndex: number;
  revealedPieces: { [pieceIndex: number]: boolean };
  centerHintQuestion: string;
  centerHintAnswer: string;
  centerHintRevealed: boolean;
  openedClueCount: number;
  eliminatedTeamIds: string[];
  turnState: Round2TurnState;
  buzzState: Round2BuzzState;
}

export interface PendingAnswer {
  teamId: string;
  answer: string;
  submittedAt: number; // epoch milliseconds
}

export interface Round2State {
  currentHorizontalOrder?: number;
  pendingAnswers?: PendingAnswer[]; // Array of answers from all teams
}

// Round 3 specific types
export interface Round3AnswerResult {
  teamId: string;
  isCorrect: boolean;
  score: number;
  submissionOrder: number; // 1-based order among correct answers
  submittedAt: number; // original submission timestamp
  judgedAt: number; // timestamp
  answer?: string; // answer text for display
}

export interface Round3State {
  currentQuestionIndex?: number; // 0-3
  pendingAnswers?: PendingAnswer[]; // Array of answers from all teams
  questionResults?: { [questionIndex: number]: Round3AnswerResult[] }; // Results for each question
}

// Round 4 specific types

export type Round4PackagePoints = 40 | 60 | 80;

export interface Round4QuestionRef {
  questionId: string;
  points: 10 | 20 | 30;
}

export interface Round4StarUsage {
  used: boolean;
  questionIndex?: number; // 0,1,2
}

export interface Round4BuzzInfo {
  teamId: string;
  buzzedAt: number;
}

export interface Round4StealWindow {
  active: boolean;
  endsAt: number;
  buzzLockedTeamId?: string;
  buzzedTeams: Round4BuzzInfo[];
}

export interface Round4StealAnswer {
  teamId: string;
  answer: string;
  submittedAt: number;
}

export interface Round4State {
  // Lượt & đội
  turnIndex: number; // 0..N-1
  currentTeamId?: string;

  // Gói & câu hỏi
  selectedPackage?: Round4PackagePoints;
  questionPattern?: number[]; // [10,10,20] ...
  currentQuestionIndex?: number; // 0..2
  questions?: Round4QuestionRef[]; // 3 câu của gói

  // Star
  starUsages: { [teamId: string]: Round4StarUsage };

  // Ngân hàng câu hỏi đã dùng theo mức điểm
  usedQuestionIdsByPoints: {
    10: string[];
    20: string[];
    30: string[];
  };

  // Đáp án của đội đang thi (chốt đáp án cuối)
  lastMainAnswer?: string;

  // Steal window & trả lời
  stealWindow?: Round4StealWindow;
  stealAnswer?: Round4StealAnswer;
}

export interface GameState {
  round: Round;
  phase: Phase;
  activeTeamId?: string;
  activePackageId?: string;
  currentQuestionId?: string;
  questionTimer?: QuestionTimer;
  teams: TeamScore[];
  round2State?: Round2State;
  round3State?: Round3State;
  round4State?: Round4State;
  createdAt: Date;
  updatedAt: Date;
}

