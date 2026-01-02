import mongoose, { Schema } from "mongoose";
import type { Round, PackageStatus, PackageHistory } from "@/types/game";

export interface IPackage extends mongoose.Document {
  number: number;
  round: Round;
  status: PackageStatus;
  assignedTeamId?: mongoose.Types.ObjectId;
  currentQuestionIndex: number;
  questions: mongoose.Types.ObjectId[];
  history: PackageHistory[];
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
  },
  { timestamps: true }
);

// Composite unique index: round + number
PackageSchema.index({ round: 1, number: 1 }, { unique: true });

const Package =
  mongoose.models.Package || mongoose.model<IPackage>("Package", PackageSchema);

export default Package;

