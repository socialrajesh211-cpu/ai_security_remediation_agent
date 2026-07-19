import {
  Paper, Typography, Stack, Box, Chip, Button, Tooltip, IconButton,
  Divider, CircularProgress, Alert, Link as MuiLink, useTheme,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BugReportIcon from "@mui/icons-material/BugReport";
import CodeIcon from "@mui/icons-material/Code";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { FeatureState } from "../api/client";
import { getSeverityColor, getNeutralStatusColor, tint } from "../theme";
import { PaletteMode } from "@mui/material";

function buildStatusStyles(mode: PaletteMode, successColor: string): Record<
  FeatureState["status"],
  { label: string; color: string; icon: JSX.Element }
> {
  const neutral = getNeutralStatusColor(mode);
  return {
    enabled: { label: "Enabled", color: successColor, icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    disabled: { label: "Not enabled", color: neutral, icon: <BugReportIcon sx={{ fontSize: 14 }} /> },
    in_progress: { label: "In progress", color: getSeverityColor(mode, "medium"), icon: <CircularProgress size={12} /> },
    restricted: { label: "Restricted", color: getSeverityColor(mode, "high"), icon: <LockOutlinedIcon sx={{ fontSize: 14 }} /> },
    unknown: { label: "Unknown", color: neutral, icon: <BugReportIcon sx={{ fontSize: 14 }} /> },
  };
}

function StatusRow({
  icon,
  label,
  feature,
  enabling,
  onEnable,
}: {
  icon: JSX.Element;
  label: string;
  feature: FeatureState | undefined;
  enabling: boolean | undefined;
  onEnable: () => void;
}) {
  const { palette } = useTheme();
  const statusStyles = buildStatusStyles(palette.mode, palette.success.main);
  const style = feature ? statusStyles[feature.status] : statusStyles.unknown;
  const color = style.color;

  return (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} py={1.25}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ mt: 0.25 }}>{icon}</Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {feature?.message ?? "Checking…"}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        <Chip
          size="small"
          icon={style.icon}
          label={enabling ? "Enabling…" : style.label}
          sx={{ bgcolor: tint(color, palette.mode === "dark" ? 0.2 : 0.12), color, fontSize: 11, height: 24 }}
        />

        {feature && feature.status === "disabled" && (
          <Button size="small" variant="outlined" onClick={onEnable} disabled={!!enabling}>
            {enabling ? "Enabling…" : "Enable"}
          </Button>
        )}

        {feature && (feature.status === "disabled" || feature.status === "restricted") && (
          <Tooltip title="Open GitHub's security settings for this repo">
            <IconButton size="small" component={MuiLink} href={feature.manageUrl} target="_blank" rel="noreferrer">
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

/**
 * Full detail panel for a repo's security features (Dependabot + code
 * scanning), including the "Enable" actions. Lives on the dedicated
 * Settings page; the Dashboard only shows a compact summary of this data.
 */
export default function SecurityFeaturesPanel({
  security,
  loading,
  enabling,
  onEnableDependabot,
  onEnableCodeScanning,
}: {
  security: { dependabot: FeatureState; codeScanning: FeatureState } | undefined;
  loading: boolean;
  enabling: { dependabot?: boolean; codeScanning?: boolean };
  onEnableDependabot: () => void;
  onEnableCodeScanning: () => void;
}) {
  const anyRestricted =
    security?.dependabot.status === "restricted" || security?.codeScanning.status === "restricted";

  return (
    <Paper variant="outlined" sx={{ p: 1.75 }}>
      {loading && !security && (
        <Stack direction="row" alignItems="center" spacing={1} py={1}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Checking Dependabot &amp; code scanning status…
          </Typography>
        </Stack>
      )}

      {security && (
        <>
          <StatusRow
            icon={<BugReportIcon fontSize="small" color="action" />}
            label="Dependabot alerts"
            feature={security.dependabot}
            enabling={enabling.dependabot}
            onEnable={onEnableDependabot}
          />
          <Divider />
          <StatusRow
            icon={<CodeIcon fontSize="small" color="action" />}
            label="Code scanning (CodeQL)"
            feature={security.codeScanning}
            enabling={enabling.codeScanning}
            onEnable={onEnableCodeScanning}
          />

          {anyRestricted && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Private repositories need GitHub Advanced Security (or org-level plan permissions) to
              turn these on through the API. Use the "open" link on the restricted item to enable it
              from the repository's GitHub settings instead.
            </Alert>
          )}
        </>
      )}

      {!loading && !security && (
        <Typography variant="body2" color="text.secondary">
          Select a repository to check its security feature status.
        </Typography>
      )}
    </Paper>
  );
}

