import { useEffect, useMemo, useRef } from "react";
import {
  Typography, Container, Grid, Paper, Chip, Stack, List,
  ListItemButton, ListItemText, Box, Button, Divider, CircularProgress, Alert,
  IconButton, Tooltip, TextField, InputAdornment, useTheme,
} from "@mui/material";
import ShieldIcon from "@mui/icons-material/Shield";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOffIcon from "@mui/icons-material/FolderOff";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GppMaybeIcon from "@mui/icons-material/GppMaybe";
import BugReportIcon from "@mui/icons-material/BugReport";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { useNavigate } from "react-router-dom";
import { Repo } from "../api/client";
import { getSeverityColor, brandGradient, tint } from "../theme";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchRepos } from "../store/slices/reposSlice";
import { scanRepo } from "../store/slices/findingsSlice";
import { fetchSecurityStatus } from "../store/slices/securitySlice";
import { fetchPreferences, saveLastSelectedRepo } from "../store/slices/preferencesSlice";
import { setSelectedRepo, setSearch } from "../store/slices/uiSlice";
import AppShell from "../components/AppShell";
import FindingsPreview from "../components/FindingsPreview";
import SecurityFeaturesCompact from "../components/SecurityFeaturesCompact";

const POLL_INTERVAL_MS = 8000;
const MAX_POLLS = 15; // ~2 minutes of polling before we give up and let the user refresh manually

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { palette } = useTheme();

  const repos = useAppSelector((s) => s.repos.items);
  const reposLoading = useAppSelector((s) => s.repos.loading);
  const reposError = useAppSelector((s) => s.repos.error);

  const search = useAppSelector((s) => s.ui.search);
  const selectedRepoFullName = useAppSelector((s) => s.ui.selectedRepoFullName);

  const findings = useAppSelector((s) =>
    selectedRepoFullName ? s.findings.byRepo[selectedRepoFullName] ?? [] : []
  );
  const scanLoading = useAppSelector((s) => s.findings.loading);
  const scanError = useAppSelector((s) => s.findings.error);
  const scanWarnings = useAppSelector((s) =>
    selectedRepoFullName ? s.findings.warningsByRepo[selectedRepoFullName] ?? [] : []
  );

  const security = useAppSelector((s) =>
    selectedRepoFullName ? s.security.byRepo[selectedRepoFullName] : undefined
  );
  const securityLoading = useAppSelector((s) =>
    selectedRepoFullName ? !!s.security.loadingByRepo[selectedRepoFullName] : false
  );
  const preferencesLoaded = useAppSelector((s) => s.preferences.loaded);
  const lastSelectedRepo = useAppSelector((s) => s.preferences.lastSelectedRepo);

  const selectedRepo = useMemo(
    () => repos?.find((r) => r.fullName === selectedRepoFullName) ?? null,
    [repos, selectedRepoFullName]
  );

  // Initial load: repositories + remembered preference (from MongoDB, with a
  // localStorage fallback baked into the preferences slice for instant restore).
  useEffect(() => {
    dispatch(fetchRepos());
    dispatch(fetchPreferences());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once both the repo list and the remembered selection have loaded, restore
  // the last-selected "tab" automatically (without re-saving the same preference).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!repos || !preferencesLoaded) return;
    restoredRef.current = true;

    if (!selectedRepoFullName && lastSelectedRepo) {
      const match = repos.find((r) => r.fullName === lastSelectedRepo);
      if (match) selectRepo(match, { persist: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, preferencesLoaded]);

  function selectRepo(repo: Repo, opts: { persist: boolean } = { persist: true }) {
    dispatch(setSelectedRepo(repo.fullName));
    const [owner, name] = repo.fullName.split("/");
    dispatch(scanRepo({ owner, repo: name }));
    dispatch(fetchSecurityStatus({ owner, repo: name }));
    if (opts.persist) dispatch(saveLastSelectedRepo(repo.fullName));
  }

  function rescan() {
    if (selectedRepo) selectRepo(selectedRepo, { persist: false });
  }

  function openFinding(findingId: string) {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.fullName.split("/");
    navigate(`/findings/${owner}/${name}/${findingId}`, { state: { from: "/dashboard" } });
  }

  // Poll security status while a feature is "in_progress" (e.g. CodeQL's first run).
  useEffect(() => {
    if (!selectedRepo) return;
    const inProgress =
      security?.dependabot.status === "in_progress" || security?.codeScanning.status === "in_progress";
    if (!inProgress) return;

    const [owner, name] = selectedRepo.fullName.split("/");
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      dispatch(fetchSecurityStatus({ owner, repo: name }));
      if (attempts >= MAX_POLLS) clearInterval(interval);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedRepo, security?.dependabot.status, security?.codeScanning.status, dispatch]);

  const counts = useMemo(() => {
    return findings.reduce(
      (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
      {} as Record<string, number>
    );
  }, [findings]);

  const securityCoverage = useMemo(() => {
    if (!security) return null;
    const on = [security.dependabot.status, security.codeScanning.status].filter(
      (s) => s === "enabled"
    ).length;
    return `${on}/2`;
  }, [security]);

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, search]);

  return (
    <AppShell>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4} lg={3}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle2" color="text.secondary">
                  YOUR REPOSITORIES
                </Typography>
                <Tooltip title="Refresh list">
                  <IconButton size="small" onClick={() => dispatch(fetchRepos())}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <TextField
                fullWidth
                size="small"
                placeholder="Filter repositories…"
                value={search}
                onChange={(e) => dispatch(setSearch(e.target.value))}
                sx={{ mb: 1.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              {reposLoading && (
                <Stack alignItems="center" py={4}>
                  <CircularProgress size={22} />
                </Stack>
              )}

              {!reposLoading && reposError && <Alert severity="error">{reposError}</Alert>}

              {!reposLoading && !reposError && repos && repos.length === 0 && (
                <EmptyRepoState />
              )}

              {!reposLoading && !reposError && filteredRepos.length > 0 && (
                <List dense sx={{ maxHeight: 520, overflowY: "auto" }}>
                  {filteredRepos.map((r) => (
                    <ListItemButton
                      key={r.id}
                      selected={selectedRepoFullName === r.fullName}
                      onClick={() => selectRepo(r)}
                      sx={{ borderRadius: 1, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={r.name}
                        secondary={r.language ?? undefined}
                        primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
                        secondaryTypographyProps={{ fontSize: 12 }}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={r.private ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <PublicIcon sx={{ fontSize: 13 }} />}
                        label={r.private ? "Private" : "Public"}
                        sx={{ ml: 1, fontSize: 11, height: 22 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}

              {selectedRepo && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    FINDINGS BY SEVERITY
                  </Typography>
                  <Stack spacing={1}>
                    {(["critical", "high", "medium", "low"] as const).map((sev) => (
                      <Stack key={sev} direction="row" justifyContent="space-between" alignItems="center">
                        <Chip
                          label={sev}
                          size="small"
                          sx={{ bgcolor: tint(getSeverityColor(palette.mode, sev)), color: getSeverityColor(palette.mode, sev) }}
                        />
                        <Typography variant="body2">{counts[sev] ?? 0}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8} lg={9}>
            {!selectedRepo && <NoRepoSelectedHero />}

            {selectedRepo && (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1">{selectedRepo.fullName}</Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={selectedRepo.private ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <PublicIcon sx={{ fontSize: 13 }} />}
                        label={selectedRepo.private ? "Private" : "Public"}
                        sx={{ fontSize: 11, height: 22 }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {selectedRepo.description || "No description"}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={scanLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                    onClick={rescan}
                    disabled={scanLoading}
                    sx={{
                      background: brandGradient(palette.mode).background,
                      color: brandGradient(palette.mode).color,
                      "&:hover": { filter: "brightness(0.92)" },
                    }}
                  >
                    {scanLoading ? "Scanning…" : "Re-run agent"}
                  </Button>
                </Stack>

                {!scanLoading && !scanError && (
                  <StatsRow
                    total={findings.length}
                    critical={counts.critical ?? 0}
                    high={counts.high ?? 0}
                    securityCoverage={securityCoverage}
                  />
                )}

                <SecurityFeaturesCompact security={security} loading={securityLoading} />

                {scanLoading && <ScanningState />}

                {!scanLoading && scanError && <Alert severity="error" sx={{ mb: 1.5 }}>{scanError}</Alert>}

                {!scanLoading &&
                  scanWarnings.map((w) => (
                    <Alert severity="warning" key={w} sx={{ mb: 1.5 }}>
                      {w}
                    </Alert>
                  ))}

                {!scanLoading && !scanError && findings.length === 0 && (
                  <Alert severity="success">
                    No open CodeQL or Dependabot findings for this repository. Nice and clean! 🎉
                  </Alert>
                )}

                {!scanLoading && findings.length > 0 && (
                  <FindingsPreview
                    findings={findings}
                    onOpen={(f) => openFinding(f.id)}
                    onViewAll={() => {
                      const [owner, name] = selectedRepo.fullName.split("/");
                      navigate(`/repos/${owner}/${name}/findings`);
                    }}
                  />
                )}
              </>
            )}
          </Grid>
        </Grid>
      </Container>
    </AppShell>
  );
}

function NoRepoSelectedHero() {
  const { palette } = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 5,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        bgcolor: tint(palette.text.primary, palette.mode === "dark" ? 0.035 : 0.02),
      }}
    >
      <Box
        sx={{
          position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none",
          background: `radial-gradient(circle at 30% 20%, ${tint(palette.primary.main, 0.14)}, transparent 45%), radial-gradient(circle at 75% 75%, ${tint(palette.secondary.main, 0.12)}, transparent 40%)`,
        }}
      />
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            width: 64, height: 64, borderRadius: "16px", mx: "auto", mb: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${tint(palette.primary.main, 0.2)}, ${tint(palette.secondary.main, 0.2)})`,
            border: `1px solid ${tint(palette.primary.main, 0.4)}`,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 30, color: "primary.main" }} />
        </Box>
        <Typography variant="h6" gutterBottom>
          Pick a repository to run the agent
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto" }}>
          Select any repository on the left. The agent pulls CodeQL and Dependabot alerts
          straight from GitHub, normalizes them into findings, and, with one click per
          issue, explains, patches, and opens a pull request for you.
        </Typography>
      </Box>
    </Paper>
  );
}

function ScanningState() {
  return (
    <Paper variant="outlined" sx={{ py: 4, mb: 1.5, textAlign: "center", position: "relative", overflow: "hidden" }}>
      <Box
        sx={{
          width: 56, height: 56, mx: "auto", mb: 2, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "primary.main",
            borderRightColor: "success.main",
            animation: "agentSpin 1s linear infinite",
            "@keyframes agentSpin": { to: { transform: "rotate(360deg)" } },
          }}
        />
        <AutoAwesomeIcon color="primary" sx={{ fontSize: 22 }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Agent is scanning this repository…
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Pulling CodeQL &amp; Dependabot alerts from GitHub and normalizing them into findings
      </Typography>
    </Paper>
  );
}

function StatsRow({
  total,
  critical,
  high,
  securityCoverage,
}: {
  total: number;
  critical: number;
  high: number;
  securityCoverage: string | null;
}) {
  const { palette } = useTheme();
  const items = [
    { label: "Open findings", value: total, icon: <ShieldIcon sx={{ fontSize: 18 }} />, color: palette.primary.main },
    { label: "Critical", value: critical, icon: <GppMaybeIcon sx={{ fontSize: 18 }} />, color: getSeverityColor(palette.mode, "critical") },
    { label: "High", value: high, icon: <BugReportIcon sx={{ fontSize: 18 }} />, color: getSeverityColor(palette.mode, "high") },
    {
      label: "Security features on",
      value: securityCoverage ?? "—",
      icon: <VerifiedUserIcon sx={{ fontSize: 18 }} />,
      color: palette.success.main,
    },
  ];

  return (
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      {items.map((it) => (
        <Grid item xs={6} sm={3} key={it.label}>
          <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5} sx={{ color: it.color }}>
              {it.icon}
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.3 }}>
                {it.label}
              </Typography>
            </Stack>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {it.value}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function EmptyRepoState() {
  const { palette } = useTheme();
  return (
    <Stack alignItems="center" textAlign="center" spacing={1.5} py={5} px={1}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          bgcolor: tint(palette.primary.main, 0.1),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FolderOffIcon sx={{ color: "primary.main" }} />
      </Box>
      <Typography variant="subtitle2">No repositories found</Typography>
      <Typography variant="body2" color="text.secondary">
        We couldn't find any repositories on your connected GitHub account.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon fontSize="small" />}
        component="a"
        href="https://github.com/new"
        target="_blank"
        rel="noreferrer"
      >
        Create a new repository
      </Button>
    </Stack>
  );
}


