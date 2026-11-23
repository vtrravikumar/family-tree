export function assertProductionApiConfiguration(
  branch: string | undefined,
  rawApiUrl: string | undefined,
): void {
  if (branch !== "production") return;

  const apiUrl = rawApiUrl?.trim();
  if (!apiUrl) {
    throw new Error("VITE_API_URL is required for production Pages builds.");
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("VITE_API_URL must be a valid absolute URL for production Pages builds.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("VITE_API_URL must use HTTPS for production Pages builds.");
  }

  if (parsed.hostname.startsWith("api-dev.")) {
    throw new Error("Production Pages builds must not use the development API.");
  }
}
