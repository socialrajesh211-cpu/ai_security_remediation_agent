import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { GithubApi, GitHubUser, DemoApi, setAuthToken, getStoredToken, setUnauthorizedHandler } from "../api/client";

interface AuthState {
  status: "checking" | "authenticated" | "unauthenticated";
  user: GitHubUser | null;
  /** True when the current session came from the "Try Demo" (Google) flow, not a real GitHub login. */
  isDemo: boolean;
  /** Only set when isDemo is true — the single repo this demo session is scoped to. */
  demoRepo: string | null;
  loginWithGitHub: () => void;
  loginWithDemo: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("checking");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoRepo, setDemoRepo] = useState<string | null>(null);

  async function refresh() {
    const token = getStoredToken();
    if (!token) {
      setStatus("unauthenticated");
      setUser(null);
      setIsDemo(false);
      setDemoRepo(null);
      return;
    }
    setAuthToken(token);
    try {
      const { user: profile, isDemo: demo, demoRepo: repo } = await GithubApi.me();
      setUser(profile);
      setIsDemo(Boolean(demo));
      setDemoRepo(repo ?? null);
      setStatus("authenticated");
    } catch {
      setAuthToken(null);
      setUser(null);
      setIsDemo(false);
      setDemoRepo(null);
      setStatus("unauthenticated");
    }
  }

  useEffect(() => {
    // Any request that comes back 401 (expired/revoked GitHub token, or an
    // expired demo session) should land the user back on the login screen
    // instead of leaving stale, silently-broken auth state around.
    setUnauthorizedHandler(() => {
      setUser(null);
      setIsDemo(false);
      setDemoRepo(null);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    // Pick up the token appended as a URL fragment by either OAuth callback
    // (GitHub's real token, or Demo Mode's opaque token) — both callbacks use
    // the same `#token=` convention, so this doesn't need to know which one it is.
    if (window.location.hash.startsWith("#token=")) {
      const token = window.location.hash.replace("#token=", "");
      setAuthToken(token);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loginWithGitHub() {
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    window.location.href = `${apiBase}/github/login`;
  }

  function loginWithDemo() {
    window.location.href = DemoApi.loginUrl();
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
    setIsDemo(false);
    setDemoRepo(null);
    setStatus("unauthenticated");
  }

  return (
    <AuthContext.Provider
      value={{ status, user, isDemo, demoRepo, loginWithGitHub, loginWithDemo, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
