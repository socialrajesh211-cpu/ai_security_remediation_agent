import {
  Paper, Typography, Stack, Chip, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Box, useTheme,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Finding } from "../api/client";
import { getSeverityColor, tint } from "../theme";
import { SOURCE_META } from "./FindingsExplorer";

const PREVIEW_COUNT = 3;
const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function sourceLabel(source: string) {
  return SOURCE_META[source]?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

/**
 * Small "top 3" preview of a repo's findings, shown on the Dashboard.
 * The full, filterable, paginated list lives on its own page.
 */
export default function FindingsPreview({
  findings,
  onOpen,
  onViewAll,
}: {
  findings: Finding[];
  onOpen: (finding: Finding) => void;
  onViewAll: () => void;
}) {
  const top = [...findings]
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, PREVIEW_COUNT);
  const { palette } = useTheme();

  return (
    <Paper variant="outlined" sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          TOP FINDINGS
        </Typography>
        <Button size="small" endIcon={<ArrowForwardIcon fontSize="small" />} onClick={onViewAll}>
          View all findings ({findings.length})
        </Button>
      </Stack>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Issue</TableCell>
              <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Location</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Reported by</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {top.map((f) => (
              <TableRow key={f.id} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(f)}>
                <TableCell>
                  <Chip
                    label={f.severity}
                    size="small"
                    sx={{ bgcolor: tint(getSeverityColor(palette.mode, f.severity)), color: getSeverityColor(palette.mode, f.severity) }}
                  />
                </TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Typography variant="body2" noWrap>{f.title}</Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, maxWidth: 220 }}>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {f.file}{f.startLine ? `:${f.startLine}` : ""}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Chip size="small" icon={SOURCE_META[f.source]?.icon} label={sourceLabel(f.source)} variant="outlined" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
