import mongoose, { Schema } from "mongoose";
import type { Round, Phase, QuestionTimer, TeamScore, Round2State, PendingAnswer } from "@/types/game";

export interface IGameState extends mongoose.Document {
  round: Round;
  phase: Phase;
  activeTeamId?: string;
  activePackageId?: string;
  currentQuestionId?: string;
  questionTimer?: QuestionTimer;
  teams: TeamScore[];
  round2State?: Round2State;
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
        "HORIZONTAL_ACTIVE",
        "HORIZONTAL_JUDGING",
        "REVEAL_PIECE",
        "CNV_LOCKED",
        "CNV_ACTIVE",
        "CNV_JUDGING",
        "FINAL_PIECE_REVEAL",
        "CENTER_HINT_ACTIVE",
        "KEYWORD_BUZZ_JUDGING",
      ],
      default: "IDLE",
    },
    activeTeamId: { type: String },
    activePackageId: { type: String },
    currentQuestionId: { type: String },
    questionTimer: QuestionTimerSchema,
    teams: [TeamScoreSchema],
    round2State: Round2StateSchema,
  },
  { timestamps: true }
);

// Ensure only one GameState document exists
GameStateSchema.index({}, { unique: true });

const GameState =
  mongoose.models.GameState || mongoose.model<IGameState>("GameState", GameStateSchema);

export default GameState;

