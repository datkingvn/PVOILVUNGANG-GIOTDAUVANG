import mongoose, { Schema } from "mongoose";
import type { Round } from "@/types/game";

export interface IQuestion extends mongoose.Document {
  text: string;
  packageId: mongoose.Types.ObjectId;
  index: number;
  round: Round;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    text: { type: String, required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },
    index: { type: Number, required: true },
    round: { type: String, required: true, enum: ["ROUND1", "ROUND2", "ROUND3", "ROUND4"] },
  },
  { timestamps: true }
);

// Composite unique index: packageId + index
QuestionSchema.index({ packageId: 1, index: 1 }, { unique: true });

const Question =
  mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);

export default Question;

