import { useEffect } from "react";
import {
  Container, Typography, Paper, Stack, Select, MenuItem, FormControl, InputLabel,
  Box, Alert, CircularProgress, Chip, Grid, Button, useTheme,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import ShieldIcon from "@mui/icons-material/Shield";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PolicyIcon from "@mui/icons-material/Policy";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import KeyIcon from "@mui/icons-material/Key";
import AddIcon from "@mui/icons-material/Add";
import AppShell from "../components/AppShell";
import SecurityFeaturesPanel from "../components/SecurityFeaturesPanel";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchRepos } from "../store/slices/reposSlice";
import { fetchSecurityStatus, enableDependabot, enableCodeScanning } from "../store/slices/securitySlice";
import { fetchPreferences, saveLastSelectedRepo } from "../store/slices/preferencesSlice";
import { setSelectedRepo } from "../store/slices/uiSlice";
import { tint } from "../theme";

const UPCOMING_FEATURES = [
  { icon: <PolicyIcon sx={{ fontSize: 17 }} />, label: "Semgrep scanning", detail: "Custom rule-based static analysis alongside CodeQL." },
  { icon: <UploadFileIcon sx={{ fontSize: 17 }} />, label: "SARIF uploads", detail: "Bring findings from any scanner you already run in CI." },
  { icon: <KeyIcon sx={{ fontSize: 17 }} />, label: "Secret scanning", detail: "Detect and help remediate leaked credentials." },
];

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { palette } = useTheme();

  const repos = useAppSelector((s) => s.repos.items);
  const reposLoading = useAppSelector((s) => s.repos.loading);
  const selectedRepoFullName = useAppSelector((s) => s.ui.selectedRepoFullName);
  const selectedRepo = useAppSelector((s) =>
    s.repos.items?.find((r) => r.fullName === selectedRepoFullName)
  );

  const security = useAppSelector((s) =>
    selectedRepoFullName ? s.security.byRepo[selectedRepoFullName] : undefined
  );
  const securityLoading = useAppSelector((s) =>
    selectedRepoFullName ? !!s.security.loadingByRepo[selectedRepoFullName] : false
  );
  const enabling = useAppSelector((s) =>
    selectedRepoFullName ? s.security.enablingByRepo[selectedRepoFullName] ?? {} : {}
  );

  useEffect(() => {
    if (!repos) dispatch(fetchRepos());
    dispatch(fetchPreferences());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRepoFullName && !security && !securityLoading) {
      const [owner, name] = selectedRepoFullName.split("/");
      dispatch(fetchSecurityStatus({ owner, repo: name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepoFullName]);

  function handleRepoChange(fullName: string) {
    dispatch(setSelectedRepo(fullName));
    dispatch(saveLastSelectedRepo(fullName));
    const [owner, name] = fullName.split("/");
    dispatch(fetchSecurityStatus({ owner, repo: name }));
  }

  return (
    <AppShell subtitle="Repository security settings">
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Page header */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={3}>
          <Box
            sx={{
              width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${tint(palette.primary.main, 0.16)}, ${tint(palette.secondary.main, 0.16)})`,
              border: `1px solid ${tint(palette.primary.main, 0.3)}`,
            }}
          >
            <ShieldIcon sx={{ fontSize: 19, color: "primary.main" }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Security settings</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
              Turn on GitHub's native vulnerability detection for a repository: Dependabot alerts
              for vulnerable dependencies, and CodeQL code scanning for insecure code patterns.
            </Typography>
          </Box>
        </Stack>

        {/* Repository + detection coverage side by side, so both fit without a long scroll */}
        <Grid container spacing={2.5} alignItems="stretch">
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2.25, height: "100%" }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <GitHubIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                <Typography variant="subtitle2" color="text.secondary">
                  REPOSITORY
                </Typography>
              </Stack>

              {!reposLoading && repos && repos.length === 0 ? (
                <Stack alignItems="center" textAlign="center" spacing={1.25} py={2}>
                  <Typography variant="body2" color="text.secondary">
                    No repositories found on your connected GitHub account.
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
              ) : (
                <FormControl size="small" fullWidth disabled={reposLoading || !repos || repos.length === 0}>
                  <InputLabel id="settings-repo-label">Choose a repository</InputLabel>
                  <Select
                    labelId="settings-repo-label"
                    label="Choose a repository"
                    value={selectedRepoFullName ?? ""}
                    onChange={(e) => handleRepoChange(e.target.value)}
                  >
                    {(repos ?? []).map((r) => (
                      <MenuItem key={r.id} value={r.fullName}>
                        {r.fullName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {reposLoading && (
                <Stack direction="row" spacing={1} alignItems="center" mt={1.25}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">Loading repositories…</Typography>
                </Stack>
              )}

              {selectedRepo && (
                <>
                  <Stack direction="row" spacing={1} alignItems="center" mt={1.5} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={selectedRepo.private ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <PublicIcon sx={{ fontSize: 13 }} />}
                      label={selectedRepo.private ? "Private" : "Public"}
                      sx={{ fontSize: 11, height: 22 }}
                    />
                    {selectedRepo.language && (
                      <Chip size="small" variant="outlined" label={selectedRepo.language} sx={{ fontSize: 11, height: 22 }} />
                    )}
                  </Stack>
                  {selectedRepo.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                      {selectedRepo.description}
                    </Typography>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            {!selectedRepoFullName ? (
              <Alert severity="info" sx={{ height: "100%", display: "flex", alignItems: "center" }}>
                Pick a repository on the left to see and manage its security features.
              </Alert>
            ) : (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  DETECTION COVERAGE
                </Typography>
                <SecurityFeaturesPanel
                  security={security}
                  loading={securityLoading}
                  enabling={enabling}
                  onEnableDependabot={() => {
                    const [owner, name] = selectedRepoFullName.split("/");
                    dispatch(enableDependabot({ owner, repo: name }));
                  }}
                  onEnableCodeScanning={() => {
                    const [owner, name] = selectedRepoFullName.split("/");
                    dispatch(enableCodeScanning({ owner, repo: name }));
                  }}
                />
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Upcoming features, laid out as a horizontal row instead of a long vertical list */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.25,
            mt: 2.5,
            position: "relative",
            overflow: "hidden",
            borderColor: tint(palette.primary.main, 0.35),
            background: `linear-gradient(135deg, ${tint(palette.primary.main, 0.08)}, ${tint(palette.secondary.main, 0.06)})`,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" mb={0.25}>
            <AutoAwesomeIcon sx={{ fontSize: 17, color: "primary.main" }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Coming soon
            </Typography>
            <Chip label="Roadmap" size="small" sx={{ height: 18, fontSize: 10, bgcolor: tint(palette.primary.main, 0.16), color: "primary.main" }} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.75 }}>
            More scanners and broader auto-remediation coverage are on the way.
          </Typography>

          <Grid container spacing={2}>
            {UPCOMING_FEATURES.map((f) => (
              <Grid item xs={12} sm={4} key={f.label}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ color: "primary.main", mt: 0.25 }}>{f.icon}</Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{f.detail}</Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Container>
    </AppShell>
  );
}
