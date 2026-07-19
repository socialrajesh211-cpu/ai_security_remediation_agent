import { Schema, model, Document } from "mongoose";

export interface UserDocument extends Document {
  githubId: number;
  username: string;
  name?: string;
  avatarUrl?: string;
  accessToken: string;
  createdAt: Date;
  lastLoginAt: Date;
}

const userSchema = new Schema<UserDocument>({
  githubId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, required: true },
  name: { type: String },
  avatarUrl: { type: String },
  // Encrypted at rest (see utils/crypto.ts) and excluded from query results by
  // default — callers that genuinely need it must opt in with `.select("+accessToken")`.
  accessToken: { type: String, required: true, select: false },
  createdAt: { type: Date, default: () => new Date() },
  lastLoginAt: { type: Date, default: () => new Date() },
});

export const User = model<UserDocument>("User", userSchema);
