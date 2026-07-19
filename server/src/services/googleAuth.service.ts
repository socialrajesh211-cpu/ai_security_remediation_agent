import axios from "axios";

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Step 2 of the Google OAuth flow: exchange the ?code= for tokens.
 * Mirrors the GitHub callback's token exchange in controllers/github.controller.ts.
 */
export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
  const { code, clientId, clientSecret, redirectUri } = params;

  const { data } = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10_000 }
  );

  if (!data.access_token) {
    throw new Error("Google did not return an access token");
  }
  return data.access_token as string;
}

/** Fetches just profile + email — the only scopes this app ever requests from Google. */
export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10_000,
  });

  return {
    googleId: data.sub,
    email: data.email,
    name: data.name ?? undefined,
    avatarUrl: data.picture ?? undefined,
  };
}
