import crypto from "node:crypto";
import { DemoSessionModel, DemoSessionDocument } from "../models/DemoSession.model";
import { DemoUser, DemoUserDocument } from "../models/DemoUser.model";
import { env } from "../config/env";

/**
 * Prefix on every demo token so the auth middleware can cheaply tell a demo
 * bearer token apart from a raw GitHub PAT (GitHub tokens never start with
 * this) without a DB lookup on every request that isn't a demo request.
 */
export const DEMO_TOKEN_PREFIX = "demo_";

function generateDemoToken(): string {
  return `${DEMO_TOKEN_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

export function isDemoToken(token: string): boolean {
  return token.startsWith(DEMO_TOKEN_PREFIX);
}

/** Upserts the DemoUser record for a verified Google profile (mirrors upsertUser in github.controller.ts). */
export async function upsertDemoUser(profile: {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}): Promise<DemoUserDocument> {
  return DemoUser.findOneAndUpdate(
    { googleId: profile.googleId },
    {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      lastLoginAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

/** Creates a fresh demo session + opaque token for a demo user. */
export async function createDemoSession(demoUserId: DemoUserDocument["_id"]): Promise<DemoSessionDocument> {
  const token = generateDemoToken();
  const expiresAt = new Date(Date.now() + env.demo.sessionTtlHours * 60 * 60 * 1000);
  return DemoSessionModel.create({ token, demoUserId, expiresAt, demoBranchNames: {} });
}

/** Resolves a bearer token to its demo session + demo user, or null if it isn't a valid/live demo session. */
export async function resolveDemoSession(
  token: string
): Promise<{ session: DemoSessionDocument; demoUser: DemoUserDocument } | null> {
  if (!isDemoToken(token)) return null;

  const session = await DemoSessionModel.findOne({ token });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const demoUser = await DemoUser.findById(session.demoUserId);
  if (!demoUser) return null;

  return { session, demoUser };
}

/** Whether Demo Mode is fully configured on this server (all required env vars set). */
export function isDemoModeConfigured(): boolean {
  return Boolean(
    env.google.clientId &&
      env.google.clientSecret &&
      env.google.callbackUrl &&
      env.demo.githubToken &&
      env.demo.repoOwner &&
      env.demo.repoName
  );
}
