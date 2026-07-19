import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Container, Box, Typography, Stack, Chip, IconButton, Tooltip, Alert, CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import AppShell from "../components/AppShell";
import FindingsExplorer from "../components/FindingsExplorer";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { scanRepo } from "../store/slices/findingsSlice";

export default function FindingsListPage() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const fullName = owner && repo ? `${owner}/${repo}` : null;

  const repoMeta = useAppSelector((s) => s.repos.items?.find((r) => r.fullName === fullName));
  const findings = useAppSelector((s) => (fullName ? s.findings.byRepo[fullName] ?? [] : []));
  const loading = useAppSelector((s) => s.findings.loading);
  const error = useAppSelector((s) => s.findings.error);

  // If the user lands here directly (refresh, shared link) without the repo
  // already scanned in this session, run the scan now.
  useEffect(() => {
    if (!owner || !repo) return;
    if (findings.length === 0) dispatch(scanRepo({ owner, repo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  function openFinding(findingId: string) {
    navigate(`/findings/${owner}/${repo}/${findingId}`, {
      state: { from: `/repos/${owner}/${repo}/findings` },
    });
  }

  return (
    <AppShell subtitle="Full findings list">
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <Tooltip title="Back to dashboard">
            <IconButton size="small" onClick={() => navigate("/dashboard")}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="h6">{fullName ?? "Findings"}</Typography>
          {repoMeta && (
            <Chip
              size="small"
              variant="outlined"
              icon={repoMeta.private ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <PublicIcon sx={{ fontSize: 13 }} />}
              label={repoMeta.private ? "Private" : "Public"}
              sx={{ fontSize: 11, height: 22 }}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={3}>
          All open findings for this repository, 20 per page.
        </Typography>

        {loading && findings.length === 0 && (
          <Stack alignItems="center" py={6}>
            <CircularProgress size={24} />
          </Stack>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && findings.length === 0 && (
          <Alert severity="success">
            No open CodeQL or Dependabot findings for this repository. Nice and clean! 🎉
          </Alert>
        )}

        {findings.length > 0 && (
          <Box>
            <FindingsExplorer findings={findings} onOpen={(f) => openFinding(f.id)} paginate />
          </Box>
        )}
      </Container>
    </AppShell>
  );
}
