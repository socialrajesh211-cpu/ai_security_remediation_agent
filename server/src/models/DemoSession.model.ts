import { Schema, model, Document, Types } from "mongoose";

/**
 * Server-side session behind the opaque demo token the browser stores.
 *
 * This is the piece that makes Demo Mode safe: the browser only ever sees
 * `token` (a random opaque string). The real `DEMO_GITHUB_TOKEN` PAT lives
 * only in server env and is attached to `req.githubToken` by the auth
 * middleware after it resolves this document — it never appears in any
 * response body, redirect URL, or client-side storage.
 *
 * Branch names for demo PRs are derived deterministically from this
 * session's DemoUser id (`security-fix/<findingId>-demo-<userId>`), and
 * `createSecurityPatchPR` in github.service.ts already reuses an existing
 * branch/PR on a 422 "already exists" response — so no separate
 * branch-name bookkeeping is needed on this document.
 */
export interface DemoSessionDocument extends Document {
  token: string;
  demoUserId: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const demoSessionSchema = new Schema<DemoSessionDocument>({
  token: { type: String, required: true, unique: true, index: true },
  demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser", required: true, index: true },
  createdAt: { type: Date, default: () => new Date() },
  // TTL index — MongoDB automatically deletes the document once expiresAt passes,
  // so demo sessions (and the browser's demo token) naturally stop working.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const DemoSessionModel = model<DemoSessionDocument>("DemoSession", demoSessionSchema);
