import { ReactNode, useState } from "react";
import {
  AppBar, Toolbar, IconButton, Typography, Box, Avatar, Stack, Tooltip,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, useTheme,
} from "@mui/material";
import { brandGradient, tint } from "../theme";
import DemoBanner from "./DemoBanner";
import MenuIcon from "@mui/icons-material/Menu";
import ShieldIcon from "@mui/icons-material/Shield";
import LogoutIcon from "@mui/icons-material/Logout";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeModeContext";

const DRAWER_WIDTH = 264;

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: <SpaceDashboardIcon fontSize="small" /> },
  { label: "Settings", path: "/settings", icon: <SettingsIcon fontSize="small" /> },
];

export default function AppShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const { palette } = useTheme();
  const gradient = brandGradient(mode);

  return (
    <Box>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Tooltip title="Menu">
            <IconButton edge="start" sx={{ mr: 1.25 }} onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          </Tooltip>

          <Box
            sx={{
              width: 34, height: 34, borderRadius: "9px", mr: 1.5,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: gradient.background,
              boxShadow: `0 0 16px ${tint(palette.primary.main, 0.45)}`,
              cursor: "pointer",
            }}
            onClick={() => navigate("/dashboard")}
          >
            <ShieldIcon sx={{ fontSize: 19, color: gradient.color }} />
          </Box>
          <Box sx={{ flexGrow: 1, cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
              AI Security Remediation Agent
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle ?? "Finds, explains, and patches vulnerabilities automatically"}
            </Typography>
          </Box>
          {user && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar src={user.avatarUrl} sx={{ width: 28, height: 28 }} />
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                {user.username}
              </Typography>
              <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                <IconButton size="small" onClick={toggleMode} aria-label="Toggle color theme">
                  {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Log out">
                <IconButton size="small" onClick={logout}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <DemoBanner />

      <Drawer
        anchor="left"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{ sx: { width: DRAWER_WIDTH, bgcolor: "background.paper", backgroundImage: "none" } }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 30, height: 30, borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: gradient.background,
            }}
          >
            <ShieldIcon sx={{ fontSize: 17, color: gradient.color }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ lineHeight: 1.1 }}>Menu</Typography>
            <Typography variant="caption" color="text.secondary">Navigate the agent</Typography>
          </Box>
        </Box>
        <Divider />

        <List sx={{ py: 1, flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => {
            const selected = location.pathname.startsWith(item.path);
            return (
              <ListItemButton
                key={item.path}
                selected={selected}
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
                sx={{
                  mx: 1, mb: 0.5, borderRadius: 1.5,
                  "&.Mui-selected": { bgcolor: tint(palette.primary.main, 0.14) },
                }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: selected ? "primary.main" : "inherit" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 500 }}
                />
              </ListItemButton>
            );
          })}
        </List>

        {user && (
          <>
            <Divider />
            <List>
              <ListItemButton onClick={logout} sx={{ mx: 1, my: 1, borderRadius: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Log out" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </List>
          </>
        )}
      </Drawer>

      {children}
    </Box>
  );
}
