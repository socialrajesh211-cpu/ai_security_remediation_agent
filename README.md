# AI Security Remediation Agent

**From security alert → AI analysis → secure patch → GitHub PR, in one flow.**

A full-stack app that connects to a GitHub account, pulls CodeQL code-scanning and
Dependabot alerts for a repository, and uses an LLM (OpenAI, Claude, or Gemini —
your choice) to explain each finding, generate a fix, and open a pull request.

```
ai-security-remediation-agent/
├── client/     React 18 + Vite + MUI + Redux Toolkit
├── server/     Node.js + Express + TypeScript + MongoDB
└── package.json  npm workspaces root (runs both together)
```

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, MUI 6, React Router, Redux Toolkit, Vite |
| Backend  | Node.js, Express, TypeScript, Octokit (GitHub API), Mongoose, Zod |
| AI       | OpenAI, Anthropic Claude, or Google Gemini — configurable per deployment |
| Data     | MongoDB — users, per-repo findings, and preferences |

## How access works

There's no anonymous or upload-based path — **GitHub OAuth is the only way in**, with an
optional Google-sign-in "Try Demo" flow (see [Demo Mode](#demo-mode)) as a second,
parallel entry point for visitors without their own GitHub account.

1. The landing page (`/`) is shown only to signed-out visitors; authenticated users are
   redirected straight to `/dashboard`.
2. Signing in lists every repository the account can see. Selecting one runs a live scan
   (CodeQL + Dependabot alerts via the GitHub API), normalizes the results into
   *findings*, and persists them in MongoDB.
3. Opening a finding runs it through three AI steps — **Analyze** → **Patch** → **Open PR**
   — each a separate, independently retryable API call.

## Getting started

Requires Node.js 18+ and a MongoDB instance (local or Atlas).

```bash
# 1. Install everything (client + server) from the repo root
npm install

# 2. Configure the server
cp server/.env.example server/.env
# fill in MONGODB_URI, an AI provider key, and your GitHub OAuth app credentials — see below

# 3. (Optional) point the client at a non-default API URL
cp client/.env.example client/.env

# 4. Run client + server together
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000 (health check at `/api/health`)

In dev, Vite proxies `/api/*` to the server — the client never needs to know its port.

### MongoDB

- **Local**: `docker run -d -p 27017:27017 mongo`, then
  `MONGODB_URI=mongodb://localhost:27017/ai-security-remediation-agent`.
- **Atlas** (free tier works): create a cluster, add a database user, allow your IP,
  and copy the `mongodb+srv://...` string into `MONGODB_URI`.

The server validates its environment at boot and refuses to start — with a clear,
itemized error — if `MONGODB_URI` or any other required variable is missing or invalid.

### GitHub OAuth

1. Create an OAuth App at https://github.com/settings/developers.
2. Set the callback URL to `http://localhost:4000/api/github/callback`.
3. Copy the client ID/secret into `server/.env` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
4. The app requests `repo`, `read:user`, and `security_events` scopes automatically —
   needed to read code-scanning/Dependabot alerts and open pull requests.

### Demo Mode

Lets a visitor try the whole flow via Google sign-in, with no GitHub account of their
own — the server signs every demo request as a single shared, tightly-scoped GitHub PAT
(`DEMO_GITHUB_TOKEN`) instead. It's **all-or-nothing**: `GET /api/auth/google/login`
returns `503 DEMO_MODE_NOT_CONFIGURED` unless every one of `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `DEMO_GITHUB_TOKEN`, `DEMO_REPO_OWNER`,
and `DEMO_REPO_NAME` is set — safe to leave all of them blank if you don't want a public
demo entry point at all.

**Setup:**
1. Create a Google OAuth Client ID at https://console.cloud.google.com/apis/credentials,
   callback URL `http://localhost:4000/api/auth/google/callback`.
2. Create a GitHub **fine-grained** PAT scoped to exactly one repo (`Contents` +
   `Pull requests`: Read and write) — this is the repo every demo visitor will see and
   act on. Never sent to the browser; the server injects it server-side per request.
3. Set `DEMO_REPO_OWNER` / `DEMO_REPO_NAME` to that repo.

**How it's scoped:** every route that takes an `:owner/:repo` is wrapped in
`restrictDemoRepoParams` (`middlewares/demoRestriction.middleware.ts`), which 403s any
demo session whose URL doesn't match `DEMO_REPO_OWNER`/`DEMO_REPO_NAME` exactly
(case-insensitive). This is defense-in-depth on top of the PAT's own GitHub-side repo
scoping, and it's what makes the demo repo swappable at any time by just changing those
two env vars and restarting.

> **Note on changing the demo repo:** because the client always builds finding links
> from whatever `DEMO_REPO_OWNER`/`DEMO_REPO_NAME` is configured *right now*, in-app
> navigation is always correct — but a bookmarked/shared finding URL captured before a
> repo swap becomes stale. `FindingWorkflow` checks the live demo scope (from
> `GET /api/github/me`'s `demoRepo` field) before it does anything else: if the URL's
> owner/repo no longer matches, it redirects to `/dashboard` instead of firing a request
> that's guaranteed to 403. This only matters on a hard refresh or a direct link open —
> normal in-app clicks serve the finding from the already-fetched Redux cache and never
> hit this path at all, which is why a stale link can look fine until you refresh it.

### AI provider

Pick one with `AI_PROVIDER` in `server/.env` (`openai` | `claude` | `gemini`) and set the
matching API key. Only the selected provider's key is required.

## Environment variables

All are read and validated in one place: `server/src/config/env.ts`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` enables stricter validation |
| `PORT` | no | `4000` | |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | Allowed CORS origin |
| `EXTRA_CORS_ORIGINS` | no | — | Comma-separated extra allowed origins |
| `TRUST_PROXY` | no | `false` | Set `true` behind a reverse proxy/load balancer |
| `MONGODB_URI` | **yes** | — | |
| `TOKEN_ENCRYPTION_KEY` | **yes in production** | — | 64-char hex string; see below |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_CALLBACK_URL` | yes | — | |
| `GITHUB_TOKEN` | no | — | Dev-only fallback PAT; ignored in production |
| `AI_PROVIDER` | no | `claude` | `openai` \| `claude` \| `gemini` |
| `AI_TIMEOUT_MS` | no | `30000` | Per-request timeout to the AI provider |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | one required | — | Matching your `AI_PROVIDER` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | `900000` / `300` | General API rate limit |
| `AI_RATE_LIMIT_MAX` | no | `30` | Stricter limit on `/api/ai/*` (costs money) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | no | — | "Try Demo" sign-in; see [Demo Mode](#demo-mode) |
| `DEMO_GITHUB_TOKEN` | no | — | Fine-grained PAT scoped to exactly one repo |
| `DEMO_REPO_OWNER` / `DEMO_REPO_NAME` | no | — | The single repo Demo Mode is locked to |
| `DEMO_SESSION_TTL_HOURS` | no | `24` | How long a demo session stays valid |

Generate `TOKEN_ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Scripts (from repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Runs client and server together |
| `npm run dev:client` / `npm run dev:server` | Run just one side |
| `npm run build` | Builds both for production |
| `npm run lint` | Lints both workspaces |

## Architecture

```
React UI (client/)
    │  Bearer-token auth, Redux Toolkit for server state
    ▼
Express API (server/)
    │
    ├── /api/github   OAuth login/callback, list repos, run a scan
    │                 (CodeQL + Dependabot → findings), open a PR
    ├── /api/findings Read back persisted findings for a repo
    └── /api/ai       AI agents: analyze → patch → draft PR
                             │
                             ▼
                    MongoDB (users, findings, preferences)
```

**Agent roles** (`server/src/services/ai.service.ts`):

- **Analysis Agent** — root cause, attack scenario, OWASP category, business impact
- **Remediation Agent** — a secure code patch with a plain-English explanation
- **PR Agent** — drafts the pull request title/description; Octokit opens the real PR

Every AI call returns structured JSON validated against a Zod schema, with typed retries
for transient failures and a normalized error taxonomy (`server/src/constants/ai.constants.ts`)
so the client always gets a specific, actionable message instead of a generic failure.

## Production hardening

- **Auth**: every protected route requires a verified GitHub Bearer token
  (`middlewares/auth.middleware.ts`); the local dev-only PAT fallback never applies
  in production.
- **Secrets at rest**: GitHub access tokens are encrypted (AES-256-GCM) before being
  stored in MongoDB and excluded from query results by default.
- **Rate limiting**: general, AI-specific, and auth-specific limits
  (`middlewares/rateLimit.middleware.ts`) — AI routes get a stricter budget since
  they cost real money per call.
- **Input validation**: Zod schemas on every mutating route, with explicit size caps on
  AI-bound fields to prevent runaway cost/context-limit abuse.
- **Security headers**: `helmet`, disabled `X-Powered-By`, response `compression`.
- **Resilience**: per-provider AI timeouts with backoff-retry on transient failures,
  bounded HTTP request/header timeouts, MongoDB connection pooling with
  `bufferCommands` disabled (fails fast instead of hanging).
- **Observability**: every request gets a traceable `X-Request-Id`; structured logging
  (JSON in production); `/api/health` reports real DB connectivity, not just "the
  process is alive."
- **Graceful shutdown**: `SIGTERM`/`SIGINT` drain in-flight requests and close the
  MongoDB connection before exiting; `uncaughtException`/`unhandledRejection` are
  logged and exit cleanly rather than leaving the process in a broken state.
- **Error handling**: a single error middleware normalizes AppErrors, malformed JSON,
  oversized payloads, and MongoDB errors into one consistent response shape, and hides
  internal error detail in production responses.
- **Client**: axios timeouts, automatic logout on an expired/revoked session, and a
  top-level error boundary so a single component failure can't blank the whole app.

## Deploying

- **Server**: any Node host (Render, Fly.io, Railway, ECS, etc). Build with
  `npm run build -w server`, run `npm start -w server`. Set `NODE_ENV=production` and
  every variable in the table above — the process refuses to boot otherwise.
- **Client**: any static host (Vercel, Netlify, Cloudflare Pages). Build with
  `npm run build -w client`; set `VITE_API_URL` to your deployed server's `/api` path.
- Set `TRUST_PROXY=true` if the server sits behind a load balancer, and list every
  production client origin in `CLIENT_ORIGIN` / `EXTRA_CORS_ORIGINS`.

## Changelog

- **Fix**: `FindingWorkflow` no longer sends a request it knows will 403 for a stale
  Demo Mode finding link (one pointing at a repo that's no longer `DEMO_REPO_OWNER`/
  `DEMO_REPO_NAME`) — it now redirects to `/dashboard` instead. Previously this only
  surfaced on a hard refresh or direct link open, since normal in-app navigation always
  serves findings from the Redux cache and never re-requests them.
- **Fix**: finding-load failures now surface the server's actual `reason` (e.g. a demo
  repo restriction, a 500, a network error) via the existing `getApiErrorMessage`
  helper, instead of always showing a generic "Finding not found."

## Roadmap

Additional scanners (Semgrep, Trivy, Gitleaks) alongside GitHub's native alerts, a
validation agent that runs lint/tests before opening a PR, multi-file remediation, and
notifications (Slack/Jira).
