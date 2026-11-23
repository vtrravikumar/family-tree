import { describe, expect, it } from "vitest";
import { assertProductionApiConfiguration } from "./apiEnvironment";

describe("production API configuration", () => {
  it("allows the production API over HTTPS", () => {
    expect(() =>
      assertProductionApiConfiguration("production", "https://api.vansvriksh.vtrrk.in"),
    ).not.toThrow();
  });

  it("rejects a missing production API URL", () => {
    expect(() => assertProductionApiConfiguration("production", undefined)).toThrow(
      /VITE_API_URL is required/,
    );
  });

  it("rejects the development API on the production branch", () => {
    expect(() =>
      assertProductionApiConfiguration("production", "https://api-dev.vansvriksh.vtrrk.in"),
    ).toThrow(/must not use the development API/);
  });

  it("rejects insecure production API URLs", () => {
    expect(() =>
      assertProductionApiConfiguration("production", "http://api.vansvriksh.vtrrk.in"),
    ).toThrow(/must use HTTPS/);
  });

  it("leaves development and preview branches free to use their configured environment", () => {
    expect(() => assertProductionApiConfiguration("main", undefined)).not.toThrow();
    expect(() => assertProductionApiConfiguration("feature-preview", undefined)).not.toThrow();
  });
});
