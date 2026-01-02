import mongoose, { Schema } from "mongoose";

export interface ITeam extends mongoose.Document {
  name: string;
  passwordHash: string;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    orderIndex: { type: Number },
  },
  { timestamps: true }
);

const Team = mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);

export default Team;

