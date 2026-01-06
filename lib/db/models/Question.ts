import mongoose, { Schema } from "mongoose";
import type { Round } from "@/types/game";

export interface IQuestion extends mongoose.Document {
  text: string;
  packageId: mongoose.Types.ObjectId;
  index: number;
  round: Round;
  // Round 4 specific: mức điểm 10/20/30 cho question bank
  points?: 10 | 20 | 30;
  answerText?: string;
  acceptedAnswers?: string[];
  type?: "horizontal" | "centerHint" | "reasoning" | "video" | "arrange";
  videoUrl?: string;
  arrangeSteps?: Array<{ label: string; text: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const ArrangeStepSchema = new Schema(
  {
    label: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    text: { type: String, required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },
    index: { type: Number, required: true },
    round: { type: String, required: true, enum: ["ROUND1", "ROUND2", "ROUND3", "ROUND4"] },
    points: { type: Number },
    answerText: { type: String },
    acceptedAnswers: [{ type: String }],
    type: { type: String, enum: ["horizontal", "centerHint", "reasoning", "video", "arrange"] },
    videoUrl: { type: String },
    arrangeSteps: [ArrangeStepSchema],
  },
  { timestamps: true }
);

// Composite unique index: packageId + index
QuestionSchema.index({ packageId: 1, index: 1 }, { unique: true });

const Question =
  mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);

export default Question;

