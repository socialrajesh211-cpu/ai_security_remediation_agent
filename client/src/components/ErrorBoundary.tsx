import { Component, ErrorInfo, ReactNode } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last-resort safety net for render-time crashes (a bad API response shape,
 * a third-party component throwing, etc). Without this, a single component
 * error blanks the entire app to a white screen — this keeps the rest of the
 * UI shell usable and gives the user a way back instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
            <Typography variant="h6">Something went wrong</Typography>
            <Typography variant="body2" color="text.secondary">
              An unexpected error occurred. You can try reloading the page — if it keeps happening,
              please let us know.
            </Typography>
            <Button variant="contained" onClick={this.handleReload}>
              Reload
            </Button>
          </Stack>
        </Box>
      </Container>
    );
  }
}
