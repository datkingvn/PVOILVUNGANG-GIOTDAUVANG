import mongoose, { Schema } from "mongoose";
import type {
  Round,
  Phase,
  QuestionTimer,
  TeamScore,
  Round2State,
  Round3State,
  Round4State,
} from "@/types/game";

export interface IGameState extends mongoose.Document {
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

const QuestionTimerSchema = new Schema<QuestionTimer>(
  {
    endsAt: { type: Number, required: true },
    running: { type: Boolean, required: true },
  },
  { _id: false }
);

const TeamScoreSchema = new Schema<TeamScore>(
  {
    teamId: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    score: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ["active", "waiting", "finished"],
      default: "waiting",
    },
  },
  { _id: false }
);

const PendingAnswerSchema = new Schema(
  {
    teamId: { type: String, required: true },
    answer: { type: String, required: true },
    submittedAt: { type: Number, required: true },
  },
  { _id: false }
);

const Round2StateSchema = new Schema(
  {
    currentHorizontalOrder: { type: Number },
    pendingAnswers: [PendingAnswerSchema],
    // Keep old fields for backward compatibility (can be removed later)
    pendingAnswer: { type: String },
    pendingTeamId: { type: String },
  },
  { _id: false, strict: false }
);

const Round3AnswerResultSchema = new Schema(
  {
    teamId: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    score: { type: Number, required: true },
    submissionOrder: { type: Number, required: true },
    submittedAt: { type: Number, required: true },
    judgedAt: { type: Number, required: true },
    answer: { type: String }, // Answer text for display
  },
  { _id: false }
);

const Round3StateSchema = new Schema(
  {
    currentQuestionIndex: { type: Number },
    pendingAnswers: [PendingAnswerSchema],
    questionResults: {
      type: Map,
      of: [Round3AnswerResultSchema],
      default: {},
    },
  },
  { _id: false, strict: false }
);

const Round4BuzzInfoSchema = new Schema(
  {
    teamId: { type: String, required: true },
    buzzedAt: { type: Number, required: true },
  },
  { _id: false }
);

const Round4StealWindowSchema = new Schema(
  {
    active: { type: Boolean, required: true },
    endsAt: { type: Number, required: true },
    buzzLockedTeamId: { type: String },
    buzzedTeams: [Round4BuzzInfoSchema],
  },
  { _id: false }
);

const Round4StealAnswerSchema = new Schema(
  {
    teamId: { type: String, required: true },
    answer: { type: String, required: true },
    submittedAt: { type: Number, required: true },
  },
  { _id: false }
);

const Round4QuestionRefSchema = new Schema(
  {
    questionId: { type: String, required: true },
    points: { type: Number, required: true },
  },
  { _id: false }
);

const Round4StateSchema = new Schema(
  {
    turnIndex: { type: Number, required: true, default: 0 },
    currentTeamId: { type: String },
    completedTeamIds: { type: [String], default: [] },
    selectedPackage: { type: Number },
    questionPattern: [{ type: Number }],
    currentQuestionIndex: { type: Number },
    questions: [Round4QuestionRefSchema],
    starUsages: {
      type: Map,
      of: new Schema(
        {
          used: { type: Boolean, required: true, default: false },
          questionIndex: { type: Number },
        },
        { _id: false }
      ),
      default: {},
    },
    usedQuestionIdsByPoints: {
      10: { type: [String], default: [] },
      20: { type: [String], default: [] },
      30: { type: [String], default: [] },
    },
    lastMainAnswer: { type: String },
    stealWindow: Round4StealWindowSchema,
    stealAnswer: Round4StealAnswerSchema,
  },
  { _id: false, strict: false }
);

const GameStateSchema = new Schema<IGameState>(
  {
    round: {
      type: String,
      required: true,
      enum: ["ROUND1", "ROUND2", "ROUND3", "ROUND4"],
      default: "ROUND1",
    },
    phase: {
      type: String,
      required: true,
      enum: [
        "IDLE",
        "ROUND_READY",
        "QUESTION_SHOW",
        "TIMER_RUNNING",
        "JUDGING",
        "REVEAL",
        "TRANSITION",
        "ROUND_END",
        // Round 2 phases
        "SETUP",
        "TURN_SELECT",
        "HORIZONTAL_SELECTED",
        "HORIZONTAL_ACTIVE",
        "HORIZONTAL_JUDGING",
        "REVEAL_PIECE",
        "CNV_LOCKED",
        "CNV_ACTIVE",
        "CNV_JUDGING",
        "FINAL_PIECE_REVEAL",
        "CENTER_HINT_ACTIVE",
        "KEYWORD_BUZZ_JUDGING",
        // Round 3 phases
        "ROUND3_READY",
        "ROUND3_QUESTION_ACTIVE",
        "ROUND3_JUDGING",
        "ROUND3_RESULTS",
        "ROUND3_END",
        // Round 4 phases
        "R4_IDLE",
        "R4_TURN_SELECT_PACKAGE",
        "R4_TURN_PICK_QUESTIONS",
        "R4_STAR_CONFIRMATION",
        "R4_QUESTION_SHOW",
        "R4_QUESTION_LOCK_MAIN",
        "R4_JUDGE_MAIN",
        "R4_STEAL_WINDOW",
        "R4_STEAL_LOCKED",
        "R4_JUDGE_STEAL",
        "R4_NEXT_QUESTION",
        "R4_NEXT_TEAM",
        "R4_END",
      ],
      default: "IDLE",
    },
    activeTeamId: { type: String },
    activePackageId: { type: String },
    currentQuestionId: { type: String },
    questionTimer: QuestionTimerSchema,
    teams: [TeamScoreSchema],
    round2State: Round2StateSchema,
    round3State: Round3StateSchema,
    round4State: Round4StateSchema,
  },
  { timestamps: true }
);

// Ensure only one GameState document exists
GameStateSchema.index({}, { unique: true });

// Clear model cache in development to ensure schema changes are picked up
if (mongoose.models.GameState) {
  delete mongoose.models.GameState;
}

const GameState = mongoose.model<IGameState>("GameState", GameStateSchema);

export default GameState;

