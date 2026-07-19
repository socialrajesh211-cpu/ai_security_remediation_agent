import { useEffect, useMemo, useState } from "react";
import {
  Box, Tabs, Tab, Stack, Chip, ToggleButtonGroup, ToggleButton, Paper,
  Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel, Typography,
  Tooltip, Pagination, useTheme,
} from "@mui/material";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TableRowsIcon from "@mui/icons-material/TableRows";
import BugReportIcon from "@mui/icons-material/BugReport";
import CodeIcon from "@mui/icons-material/Code";
import PolicyIcon from "@mui/icons-material/Policy";
import { Finding } from "../api/client";
import { getSeverityColor, tint } from "../theme";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setSourceTab, setViewMode, toggleSeverityFilter, setSort,
  FindingsSortKey, Severity,
} from "../store/slices/uiSlice";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export const SOURCE_META: Record<string, { label: string; icon: JSX.Element }> = {
  codeql: { label: "Code scanning", icon: <CodeIcon sx={{ fontSize: 15 }} /> },
  dependabot: { label: "Dependencies", icon: <BugReportIcon sx={{ fontSize: 15 }} /> },
  semgrep: { label: "Semgrep", icon: <PolicyIcon sx={{ fontSize: 15 }} /> },
  sarif: { label: "SARIF upload", icon: <PolicyIcon sx={{ fontSize: 15 }} /> },
};

function sourceLabel(source: string) {
  return SOURCE_META[source]?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const PAGE_SIZE = 20;

export default function FindingsExplorer({
  findings,
  onOpen,
  paginate = false,
}: {
  findings: Finding[];
  onOpen: (finding: Finding) => void;
  /** Paginate results 20 at a time — used on the full findings list page. */
  paginate?: boolean;
}) {
  const dispatch = useAppDispatch();
  const { palette } = useTheme();
  const sourceTab = useAppSelector((s) => s.ui.sourceTab);
  const viewMode = useAppSelector((s) => s.ui.viewMode);
  const severityFilter = useAppSelector((s) => s.ui.severityFilter);
  const sortKey = useAppSelector((s) => s.ui.sortKey);
  const sortDir = useAppSelector((s) => s.ui.sortDir);

  // Distinct scanner sources actually present in this repo's findings — new
  // scanners (Semgrep, SARIF uploads, etc.) show up as their own tab automatically.
  const sourcesPresent = useMemo(() => {
    const set = new Set(findings.map((f) => f.source));
    return Array.from(set);
  }, [findings]);

  const countsBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => {
      counts[f.source] = (counts[f.source] ?? 0) + 1;
    });
    return counts;
  }, [findings]);

  const afterTab = useMemo(
    () => (sourceTab === "all" ? findings : findings.filter((f) => f.source === sourceTab)),
    [findings, sourceTab]
  );

  const afterSeverity = useMemo(
    () =>
      severityFilter.length === 0
        ? afterTab
        : afterTab.filter((f) => severityFilter.includes(f.severity as Severity)),
    [afterTab, severityFilter]
  );

  const sorted = useMemo(() => {
    const copy = [...afterSeverity];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "severity") cmp = severityRank[a.severity] - severityRank[b.severity];
      else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "file") cmp = a.file.localeCompare(b.file);
      else if (sortKey === "source") cmp = a.source.localeCompare(b.source);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [afterSeverity, sortKey, sortDir]);

  function requestSort(key: FindingsSortKey) {
    if (key === sortKey) {
      dispatch(setSort({ key, dir: sortDir === "asc" ? "desc" : "asc" }));
    } else {
      dispatch(setSort({ key, dir: key === "severity" ? "desc" : "asc" }));
    }
  }

  // Reset to page 1 whenever the visible result set changes shape.
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [sourceTab, severityFilter, sortKey, sortDir, findings.length]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = paginate ? sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : sorted;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        mb={1.5}
      >
        <Tabs
          value={sourceTab}
          onChange={(_, v) => dispatch(setSourceTab(v))}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: 13 } }}
        >
          <Tab value="all" label={`All issues (${findings.length})`} />
          {sourcesPresent.map((s) => (
            <Tab
              key={s}
              value={s}
              icon={SOURCE_META[s]?.icon}
              iconPosition="start"
              label={`${sourceLabel(s)} (${countsBySource[s]})`}
            />
          ))}
        </Tabs>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={(_, v) => v && dispatch(setViewMode(v))}
        >
          <ToggleButton value="cards" aria-label="Card view">
            <Tooltip title="Card view"><ViewModuleIcon fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="table" aria-label="Table view">
            <Tooltip title="Table view"><TableRowsIcon fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" mb={2} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          FILTER BY SEVERITY
        </Typography>
        {SEVERITIES.map((sev) => {
          const active = severityFilter.includes(sev);
          const sevColor = getSeverityColor(palette.mode, sev);
          return (
            <Chip
              key={sev}
              label={sev}
              size="small"
              onClick={() => dispatch(toggleSeverityFilter(sev))}
              sx={{
                cursor: "pointer",
                fontWeight: 600,
                color: active ? palette.getContrastText(sevColor) : sevColor,
                bgcolor: active ? sevColor : tint(sevColor, 0.12),
                border: `1px solid ${tint(sevColor, 0.5)}`,
                "&:hover": { bgcolor: active ? sevColor : tint(sevColor, 0.22) },
              }}
            />
          );
        })}
        {severityFilter.length > 0 && (
          <Typography
            variant="caption"
            color="primary.main"
            sx={{ cursor: "pointer", ml: 0.5 }}
            onClick={() => SEVERITIES.forEach((s) => severityFilter.includes(s) && dispatch(toggleSeverityFilter(s)))}
          >
            Clear
          </Typography>
        )}
      </Stack>

      {sorted.length === 0 && findings.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No findings match the current filters.
          </Typography>
        </Paper>
      )}

      {sorted.length > 0 && viewMode === "cards" && (
        <Stack spacing={1.25}>
          {paged.map((f) => (
            <Paper
              key={f.id}
              variant="outlined"
              sx={{
                p: 2,
                cursor: "pointer",
                transition: "border-color .15s ease, transform .15s ease",
                "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
              }}
              onClick={() => onOpen(f)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {f.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {f.file}
                    {f.startLine ? `:${f.startLine}` : ""} {f.cwe ? `· ${f.cwe}` : ""}
                    {f.cve ? `· ${f.cve}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Chip
                    size="small"
                    icon={SOURCE_META[f.source]?.icon}
                    label={sourceLabel(f.source)}
                    variant="outlined"
                  />
                  <Chip
                    label={f.severity}
                    size="small"
                    sx={{ bgcolor: tint(getSeverityColor(palette.mode, f.severity)), color: getSeverityColor(palette.mode, f.severity) }}
                  />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {sorted.length > 0 && viewMode === "table" && (
        <Paper variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "severity"}
                    direction={sortKey === "severity" ? sortDir : "desc"}
                    onClick={() => requestSort("severity")}
                  >
                    Severity
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "title"}
                    direction={sortKey === "title" ? sortDir : "asc"}
                    onClick={() => requestSort("title")}
                  >
                    Issue
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "file"}
                    direction={sortKey === "file" ? sortDir : "asc"}
                    onClick={() => requestSort("file")}
                  >
                    Location
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "source"}
                    direction={sortKey === "source" ? sortDir : "asc"}
                    onClick={() => requestSort("source")}
                  >
                    Reported by
                  </TableSortLabel>
                </TableCell>
                <TableCell>Reference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((f) => (
                <TableRow
                  key={f.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onOpen(f)}
                >
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
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {f.file}{f.startLine ? `:${f.startLine}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" icon={SOURCE_META[f.source]?.icon} label={sourceLabel(f.source)} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {f.cwe ?? f.cve ?? "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {paginate && sorted.length > PAGE_SIZE && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
          <Typography variant="caption" color="text.secondary">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </Typography>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, p) => setPage(p)}
            size="small"
            color="primary"
            shape="rounded"
          />
        </Stack>
      )}
    </Box>
  );
}
