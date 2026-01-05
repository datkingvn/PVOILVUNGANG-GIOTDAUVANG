import mongoose, { Schema } from "mongoose";
import type { Round, PackageStatus, PackageHistory, Round2Meta } from "@/types/game";

export interface IPackage extends mongoose.Document {
  number: number;
  round: Round;
  status: PackageStatus;
  assignedTeamId?: mongoose.Types.ObjectId;
  currentQuestionIndex: number;
  questions: mongoose.Types.ObjectId[];
  history: PackageHistory[];
  round2Meta?: Round2Meta;
  createdAt: Date;
  updatedAt: Date;
}

const PackageHistorySchema = new Schema<PackageHistory>(
  {
    index: { type: Number, required: true },
    questionId: { type: String, required: true },
    result: {
      type: String,
      required: true,
      enum: ["CORRECT", "WRONG", "TIMEOUT", "NO_ANSWER"],
    },
    judgedBy: { type: String },
    judgedAt: { type: Date, required: true },
  },
  { _id: false }
);

const Round2ImagePieceSchema = new Schema(
  {
    index: { type: Number, required: true, enum: [1, 2, 3, 4] },
    url: { type: String, required: true },
  },
  { _id: false }
);

const Round2ImageSchema = new Schema(
  {
    originalUrl: { type: String, required: true },
    pieces: [Round2ImagePieceSchema],
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
  },
  { _id: false }
);

const Round2MappingSchema = new Schema(
  {
    horizontalOrder: { type: Number, required: true },
    pieceIndex: { type: Number, required: true },
  },
  { _id: false }
);

const Round2TurnStateSchema = new Schema(
  {
    currentTeamId: { type: String },
    teamsUsedHorizontalAttempt: { type: Map, of: Boolean, default: {} },
  },
  { _id: false }
);

const KeywordBuzzQueueItemSchema = new Schema(
  {
    teamId: { type: String, required: true },
    buzzedAt: { type: Number, required: true },
  },
  { _id: false }
);

const Round2BuzzStateSchema = new Schema(
  {
    cnvLockTeamId: { type: String },
    cnvLockEndsAt: { type: Number },
    keywordBuzzQueue: [KeywordBuzzQueueItemSchema],
    currentKeywordBuzzIndex: { type: Number },
    keywordWinnerTeamId: { type: String },
  },
  { _id: false }
);

const Round2MetaSchema = new Schema(
  {
    cnvAnswer: { type: String },
    cnvLetterCount: { type: Number },
    image: Round2ImageSchema,
    mapping: [Round2MappingSchema],
    finalPieceIndex: { type: Number },
    revealedPieces: { type: Map, of: Boolean, default: {} },
    centerHintQuestion: { type: String },
    centerHintAnswer: { type: String },
    centerHintRevealed: { type: Boolean, default: false },
    openedClueCount: { type: Number, default: 0 },
    eliminatedTeamIds: [{ type: String }],
    turnState: Round2TurnStateSchema,
    buzzState: Round2BuzzStateSchema,
  },
  { _id: false, strict: false }
);

const PackageSchema = new Schema<IPackage>(
  {
    number: { type: Number, required: true },
    round: { type: String, required: true, enum: ["ROUND1", "ROUND2", "ROUND3", "ROUND4"] },
    status: {
      type: String,
      required: true,
      enum: ["unassigned", "in_progress", "completed"],
      default: "unassigned",
    },
    assignedTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    currentQuestionIndex: { type: Number, default: 0 },
    questions: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    history: [PackageHistorySchema],
    round2Meta: Round2MetaSchema,
  },
  { timestamps: true }
);

// Composite unique index: round + number
PackageSchema.index({ round: 1, number: 1 }, { unique: true });

const Package =
  mongoose.models.Package || mongoose.model<IPackage>("Package", PackageSchema);

export default Package;

