import { Paper, Typography, Stack, Box, Chip, Tooltip, IconButton, CircularProgress, useTheme } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import BugReportIcon from "@mui/icons-material/BugReport";
import CodeIcon from "@mui/icons-material/Code";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { FeatureState } from "../api/client";
import { getSeverityColor, getNeutralStatusColor, tint } from "../theme";
import { PaletteMode } from "@mui/material";

function buildStatusColor(mode: PaletteMode, successColor: string): Record<FeatureState["status"], string> {
  const neutral = getNeutralStatusColor(mode);
  return {
    enabled: successColor,
    disabled: neutral,
    in_progress: getSeverityColor(mode, "medium"),
    restricted: getSeverityColor(mode, "high"),
    unknown: neutral,
  };
}

const statusLabel: Record<FeatureState["status"], string> = {
  enabled: "Enabled",
  disabled: "Not enabled",
  in_progress: "In progress",
  restricted: "Restricted",
  unknown: "Unknown",
};

function statusIcon(status: FeatureState["status"]) {
  if (status === "enabled") return <CheckCircleIcon sx={{ fontSize: 13 }} />;
  if (status === "restricted") return <LockOutlinedIcon sx={{ fontSize: 13 }} />;
  if (status === "in_progress") return <CircularProgress size={11} />;
  return undefined;
}

function CompactRow({ icon, label, feature }: { icon: JSX.Element; label: string; feature: FeatureState | undefined }) {
  const { palette } = useTheme();
  const statusColor = buildStatusColor(palette.mode, palette.success.main);
  const status = feature?.status ?? "unknown";
  const color = statusColor[status];
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" py={0.75}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
        <Typography variant="body2" noWrap>
          {label}
        </Typography>
      </Stack>
      <Chip
        size="small"
        icon={statusIcon(status)}
        label={statusLabel[status]}
        sx={{ bgcolor: tint(color, palette.mode === "dark" ? 0.2 : 0.12), color, fontSize: 11, height: 22, flexShrink: 0 }}
      />
    </Stack>
  );
}

/**
 * Compact "at a glance" summary of the two security features shown on the
 * Dashboard. Full detail + the "Enable" actions live on the Settings page,
 * reached via the gear icon here.
 */
export default function SecurityFeaturesCompact({
  security,
  loading,
}: {
  security: { dependabot: FeatureState; codeScanning: FeatureState } | undefined;
  loading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Paper variant="outlined" sx={{ p: 1.75, mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="subtitle2" color="text.secondary">
          SECURITY FEATURES
        </Typography>
        <Tooltip title="Manage security features">
          <IconButton size="small" onClick={() => navigate("/settings")} aria-label="Open security settings">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading && !security && (
        <Stack direction="row" alignItems="center" spacing={1} py={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Checking status…
          </Typography>
        </Stack>
      )}

      {security && (
        <Stack divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
          <CompactRow icon={<BugReportIcon sx={{ fontSize: 16 }} />} label="Dependabot alerts" feature={security.dependabot} />
          <CompactRow icon={<CodeIcon sx={{ fontSize: 16 }} />} label="Code scanning (CodeQL)" feature={security.codeScanning} />
        </Stack>
      )}

      {!loading && !security && (
        <Typography variant="body2" color="text.secondary">
          Select a repository to see its status.
        </Typography>
      )}
    </Paper>
  );
}
