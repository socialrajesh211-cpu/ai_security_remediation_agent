import { Schema, model, Document } from "mongoose";

/**
 * Per-user UI preferences that should survive across sessions/devices —
 * e.g. the last repository/tab the user had selected on the dashboard.
 * Keyed by GitHub user id so it's independent of the (rotating) access token.
 */
export interface PreferenceDocument extends Document {
  githubId: number;
  lastSelectedRepo?: string; // "owner/repo"
  updatedAt: Date;
}

const preferenceSchema = new Schema<PreferenceDocument>({
  githubId: { type: Number, required: true, unique: true, index: true },
  lastSelectedRepo: { type: String },
  updatedAt: { type: Date, default: () => new Date() },
});

export const PreferenceModel = model<PreferenceDocument>("Preference", preferenceSchema);
