import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Container, Box, Paper, Chip, Stack, Button,
  Grid, Divider, Alert, AlertTitle, ToggleButtonGroup, ToggleButton, IconButton,
  Stepper, Step, StepLabel, StepButton, Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ShieldIcon from "@mui/icons-material/Shield";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BuildIcon from "@mui/icons-material/Build";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DescriptionIcon from "@mui/icons-material/Description";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { FindingsApi, Finding, getApiErrorMessage } from "../api/client";
import { getSeverityColor, monoFont, brandGradient, tint } from "../theme";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { runAnalysis, runPatch, runPullRequest, setAudience, Audience } from "../store/slices/findingWorkflowSlice";
import { SOURCE_META } from "../components/FindingsExplorer";
import AiProgressBar from "../components/AiProgressBar";
import ConfidenceChip from "../components/ConfidenceChip";
import { useThemeMode } from "../context/ThemeModeContext";
import { useAuth } from "../context/AuthContext";

type Stage = "details" | "analysis" | "patch" | "pr";

const STEPS: { key: Stage; label: string; blurb: string }[] = [
  { key: "details", label: "Finding details", blurb: "Review what the scanner found and the raw code involved." },
  { key: "analysis", label: "AI explanation", blurb: "Ask the AI to explain root cause, impact, and how exploitable this is." },
  { key: "patch", label: "Secure patch", blurb: "Generate a suggested code fix for this finding." },
  { key: "pr", label: "Pull request", blurb: "Open (or draft) a pull request with the patch applied." },
];

export default function FindingWorkflow() {
  const { owner, repo, findingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { mode, toggleMode } = useThemeMode();
  const gradientCta = brandGradient(mode);

  // Where "back" / "done" should return to — the Dashboard if the finding was
  // opened from there, or the full findings list page if opened from there.
  // Falls back to the Dashboard if the page was opened directly (e.g. refresh).
  const backTo: string = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const backLabel = backTo === "/dashboard" ? "dashboard" : "findings list";

  const [finding, setFinding] = useState<Finding | null>(null);
  const [findingError, setFindingError] = useState<string | null>(null);

  // Reuse a repo's already-scanned findings if we have them, so opening a
  // finding is instant and doesn't depend on hitting the API again.
  const cachedFinding = useAppSelector((s) => {
    if (!owner || !repo || !findingId) return undefined;
    const list = s.findings.byRepo[`${owner}/${repo}`];
    return list?.find((f) => f.id === findingId);
  });

  const { isDemo, demoRepo } = useAuth();

  // A demo session is hard-locked to exactly one repo, and that repo can
  // change between when a link was generated (or shared/bookmarked) and now.
  // Normal in-app navigation always builds links from the *current* demo
  // repo, so this mismatch is invisible there — it only surfaces when a
  // stale URL is opened directly (a hard refresh, a bookmark, a shared
  // link), which skips the Redux cache and would otherwise hit the API and
  // get a 403 from the server's demo-repo restriction. Catch it here first
  // and send the user somewhere useful instead of showing a dead end.
  const isStaleDemoLink =
    isDemo && Boolean(demoRepo) && owner && repo && `${owner}/${repo}`.toLowerCase() !== demoRepo!.toLowerCase();

  useEffect(() => {
    if (isStaleDemoLink) {
      navigate("/dashboard", { replace: true });
    }
  }, [isStaleDemoLink, navigate]);

  useEffect(() => {
    if (isStaleDemoLink) return;
    if (cachedFinding) {
      setFinding(cachedFinding);
      return;
    }
    if (owner && repo && findingId) {
      FindingsApi.get(owner, repo, findingId)
        .then(setFinding)
        .catch((err) => setFindingError(getApiErrorMessage(err, "Finding not found.")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, findingId]);

  // All AI-workflow state (analysis / patch / PR / stage) lives in Redux, keyed
  // by finding id, so it survives navigating back to the dashboard and returning.
  const workflow = useAppSelector((s) =>
    findingId ? s.findingWorkflow.byFinding[findingId] : undefined
  );
  const furthestStage: Stage = workflow?.stage ?? "details";
  const audience: Audience = workflow?.audience ?? "senior";
  const analysis = workflow?.analysis ?? null;
  const patch = workflow?.patch ?? null;
  const prResult = workflow?.prResult ?? null;
  const analyzing = !!workflow?.analyzing;
  const patching = !!workflow?.patching;
  const creatingPr = !!workflow?.creatingPr;
  const anyLoading = analyzing || patching || creatingPr;
  const workflowError = workflow?.error ?? null;

  const completed: Record<Stage, boolean> = {
    details: !!finding,
    analysis: !!analysis,
    patch: !!patch,
    pr: !!prResult,
  };

  // `activeView` is which single step's content is on screen right now — this
  // is what makes the workflow feel like paged steps instead of one long
  // scroll. It defaults to wherever the user last got to on this finding.
  const [activeView, setActiveView] = useState<Stage>(furthestStage);
  useEffect(() => {
    setActiveView(furthestStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findingId]);

  const activeIndex = STEPS.findIndex((s) => s.key === activeView);

  function goToStep(key: Stage) {
    if (key !== "details" && !completed[key]) return;
    setActiveView(key);
  }

  async function runAnalysisStep() {
    if (!finding) return;
    try {
      await dispatch(runAnalysis({ finding, audience })).unwrap();
      setActiveView("analysis");
    } catch {
      // error surfaced via workflow.error
    }
  }

  async function runPatchStep() {
    if (!finding) return;
    try {
      await dispatch(runPatch({ finding })).unwrap();
      setActiveView("patch");
    } catch {
      // error surfaced via workflow.error
    }
  }

  async function runPullRequestStep(openPr: boolean) {
    if (!finding || !patch || !owner || !repo) return;
    try {
      await dispatch(runPullRequest({ finding, patch, owner, repo, openPr })).unwrap();
      setActiveView("pr");
    } catch {
      // error surfaced via workflow.error
    }
  }

  if (!finding) {
    return (
      <Container sx={{ py: 6 }}>
        {findingError ? <Alert severity="error">{findingError}</Alert> : <AiProgressBar active label="Loading finding…" />}
      </Container>
    );
  }

  const progressLabel = analyzing
    ? "Analyzing the vulnerability with AI…"
    : patching
    ? "Generating a secure patch…"
    : creatingPr
    ? "Opening the pull request…"
    : "";

  return (
    <Box>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Tooltip title={`Back to ${backLabel}`}>
            <IconButton edge="start" sx={{ mr: 1 }} onClick={() => navigate(backTo)}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <ShieldIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>AI Security Remediation Agent</Typography>
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton size="small" onClick={toggleMode} aria-label="Toggle color theme">
              {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {owner}/{repo}
        </Typography>

        <Grid container spacing={3}>
          {/* Sidebar: finding summary + workflow steps stay visible across all stages,
              so the wide screen is put to use instead of sitting empty beside a single
              narrow column. */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2.5} sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} mb={1.5}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}
                  >
                    {finding.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={finding.severity}
                    sx={{ bgcolor: tint(getSeverityColor(mode, finding.severity)), color: getSeverityColor(mode, finding.severity), flexShrink: 0 }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} mb={1.75} flexWrap="wrap" useFlexGap>
                  {finding.cwe && <Chip size="small" label={finding.cwe} variant="outlined" />}
                  {finding.cve && <Chip size="small" label={finding.cve} variant="outlined" />}
                  <Chip
                    size="small"
                    icon={SOURCE_META[finding.source]?.icon}
                    label={SOURCE_META[finding.source]?.label ?? finding.source}
                    variant="outlined"
                  />
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.75, overflowWrap: "anywhere", wordBreak: "break-word" }}
                >
                  {finding.description}
                </Typography>

                <Divider sx={{ mb: 1.5 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  LOCATION
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: monoFont, fontSize: 13, wordBreak: "break-all" }}>
                  {finding.file}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lines {finding.startLine}-{finding.endLine}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  WORKFLOW
                </Typography>
                <Stepper nonLinear activeStep={activeIndex} orientation="vertical">
                  {STEPS.map((s) => (
                    <Step key={s.key} completed={completed[s.key]}>
                      <StepButton onClick={() => goToStep(s.key)} disabled={s.key !== "details" && !completed[s.key]}>
                        <StepLabel
                          optional={
                            <Typography variant="caption" color="text.secondary">
                              {s.blurb}
                            </Typography>
                          }
                        >
                          {s.label}
                        </StepLabel>
                      </StepButton>
                    </Step>
                  ))}
                </Stepper>
              </Paper>
            </Stack>
          </Grid>

          {/* Main column: only the content for the active step */}
          <Grid item xs={12} md={8}>
            <Alert severity="info" icon={<AutoAwesomeIcon fontSize="small" />} sx={{ mb: 2 }}>
              <strong>Step {activeIndex + 1} of {STEPS.length}: {STEPS[activeIndex].label}.</strong>{" "}
              {STEPS[activeIndex].blurb}
            </Alert>

            <AiProgressBar active={anyLoading} label={progressLabel || "Working…"} />
            {workflowError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>{workflowError.message}</AlertTitle>
                {workflowError.reason && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {workflowError.reason}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ fontWeight: workflowError.adminActionRequired ? 600 : 400 }}>
                  {workflowError.adminActionRequired
                    ? "This needs a server-side fix. Please reach out to your admin to resolve it."
                    : "This is usually temporary. Feel free to try again in a moment."}
                </Typography>
              </Alert>
            )}

            {/* ---- Page 1: Finding details ---- */}
            {activeView === "details" && (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  CODE SNIPPET
                </Typography>
                {finding.codeSnippet ? (
                  <Box
                    component="pre"
                    sx={{
                      p: 2, bgcolor: "background.default", borderRadius: 1,
                      fontFamily: monoFont, fontSize: 13,
                      overflowX: "auto", overflowY: "auto",
                      maxHeight: 420,
                      m: 0,
                    }}
                  >
                    {finding.codeSnippet}
                  </Box>
                ) : (
                  <Alert severity="info" icon={<DescriptionIcon fontSize="small" />}>
                    No code snippet is available for this finding. This usually happens when the
                    file couldn't be read from the repository (deleted since the alert was raised,
                    a binary file, or the token doesn't have read access), though the file location
                    in the sidebar is still accurate. Try re-running the agent, or open the finding
                    directly on{" "}
                    <a
                      href={`https://github.com/${owner}/${repo}/blob/HEAD/${finding.file}#L${finding.startLine}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub
                    </a>.
                  </Alert>
                )}

                <Divider sx={{ my: 3 }} />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={audience}
                    onChange={(_, v) => v && findingId && dispatch(setAudience({ findingId, audience: v }))}
                  >
                    <ToggleButton value="senior">Senior Engineer</ToggleButton>
                    <ToggleButton value="junior">Junior Dev</ToggleButton>
                    <ToggleButton value="product">Product Manager</ToggleButton>
                  </ToggleButtonGroup>

                  {!analysis ? (
                    <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={runAnalysisStep} disabled={anyLoading} sx={gradientCta}>
                      Explain with AI
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={runAnalysisStep} disabled={anyLoading}>
                        Re-analyze
                      </Button>
                      <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setActiveView("analysis")} sx={gradientCta}>
                        View AI Explanation
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            )}

            {/* ---- Page 2: AI Analysis ---- */}
            {activeView === "analysis" && analysis && (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">AI Analysis</Typography>
                  <ConfidenceChip value={analysis.confidence} />
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field label="Root Cause" value={analysis.rootCause} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field label="OWASP Category" value={analysis.owaspCategory} />
                  </Grid>
                  <Grid item xs={12}>
                    <Field label="Why Vulnerable" value={analysis.whyVulnerable} />
                  </Grid>
                  <Grid item xs={12}>
                    <Field label="Attack Example" value={analysis.attackExample} mono />
                  </Grid>
                  <Grid item xs={12}>
                    <Field label="Business Impact" value={analysis.businessImpact} />
                  </Grid>
                  <Grid item xs={4}>
                    <Field label="Likelihood" value={analysis.likelihood} />
                  </Grid>
                  <Grid item xs={4}>
                    <Field label="Exploitability" value={analysis.exploitability} />
                  </Grid>
                  <Grid item xs={4}>
                    <Field label="Priority" value={analysis.priority} />
                  </Grid>
                  <Grid item xs={12}>
                    <Field label="Recommendation" value={analysis.recommendation} />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                  <Button size="small" startIcon={<ChevronLeftIcon />} onClick={() => setActiveView("details")}>
                    Back to details
                  </Button>

                  {!patch ? (
                    <Button variant="contained" startIcon={<BuildIcon />} onClick={runPatchStep} disabled={anyLoading} sx={gradientCta}>
                      Generate Secure Patch
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={runPatchStep} disabled={anyLoading}>
                        Regenerate
                      </Button>
                      <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setActiveView("patch")} sx={gradientCta}>
                        View Secure Patch
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            )}

            {/* ---- Page 3: Generated Patch ---- */}
            {activeView === "patch" && patch && (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1">Generated Patch</Typography>
                  <Stack direction="row" spacing={1}>
                    <ConfidenceChip value={patch.confidence} />
                    {patch.testsRecommended && <Chip size="small" label="Tests recommended" variant="outlined" />}
                  </Stack>
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="error.main">OLD CODE</Typography>
                    <Box component="pre" sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, fontFamily: monoFont, fontSize: 12.5, overflowX: "auto" }}>
                      {patch.originalCode}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="success.main">NEW CODE</Typography>
                    <Box component="pre" sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, fontFamily: monoFont, fontSize: 12.5, overflowX: "auto" }}>
                      {patch.patchedCode}
                    </Box>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" mt={2}>
                  {patch.explanation}
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                  <Button size="small" startIcon={<ChevronLeftIcon />} onClick={() => setActiveView("analysis")}>
                    Back to AI explanation
                  </Button>

                  {!prResult ? (
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={runPatchStep} disabled={anyLoading}>Regenerate</Button>
                      <Button variant="contained" startIcon={<RocketLaunchIcon />} onClick={() => runPullRequestStep(true)} disabled={anyLoading} sx={gradientCta}>
                        Create Pull Request
                      </Button>
                    </Stack>
                  ) : (
                    <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setActiveView("pr")} sx={gradientCta}>
                      View Pull Request
                    </Button>
                  )}
                </Stack>
              </Paper>
            )}

            {/* ---- Page 4: Pull Request ---- */}
            {activeView === "pr" && prResult && (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" gutterBottom>Pull Request</Typography>
                <Field label="Title" value={prResult.draft.title} />
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">DESCRIPTION</Typography>
                  <Box component="pre" sx={{ p: 2, bgcolor: "background.default", borderRadius: 1, whiteSpace: "pre-wrap", fontFamily: monoFont, fontSize: 12.5 }}>
                    {prResult.draft.description}
                  </Box>
                </Box>
                {prResult.pr?.url ? (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    PR opened:{" "}
                    <a href={prResult.pr.url} target="_blank" rel="noreferrer">
                      view on GitHub
                    </a>
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Draft ready. Provide a valid GitHub token to open the PR automatically.
                  </Alert>
                )}

                <Divider sx={{ my: 3 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Button size="small" startIcon={<ChevronLeftIcon />} onClick={() => setActiveView("patch")}>
                    Back to patch
                  </Button>
                  <Button variant="outlined" onClick={() => navigate(backTo)}>
                    Done, back to {backLabel}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label.toUpperCase()}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? monoFont : undefined }}>
        {value}
      </Typography>
    </Box>
  );
}
