import mongoose, { Schema } from "mongoose";

export interface IUser extends mongoose.Document {
  username: string;
  passwordHash: string;
  role: "MC";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["MC"], default: "MC" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

