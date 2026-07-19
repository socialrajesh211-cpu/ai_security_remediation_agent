import { Schema, model, Document } from "mongoose";

/**
 * A visitor who signed in with Google to try Demo Mode. Deliberately kept in
 * its own collection, separate from `User` (GitHub identities) — demo users
 * never hold a GitHub token of their own, so mixing the two schemas would
 * either force a fake githubId or make `accessToken` optional everywhere.
 */
export interface DemoUserDocument extends Document {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

const demoUserSchema = new Schema<DemoUserDocument>({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  name: { type: String },
  avatarUrl: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  lastLoginAt: { type: Date, default: () => new Date() },
});

export const DemoUser = model<DemoUserDocument>("DemoUser", demoUserSchema);
