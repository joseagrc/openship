export const ENVIRONMENTS = ["production", "staging", "development"] as const;
export const LEGACY_ENVIRONMENTS = ["preview"] as const;

export type Environment = (typeof ENVIRONMENTS)[number];
export type LegacyEnvironment = (typeof LEGACY_ENVIRONMENTS)[number];
export type EnvironmentInput = Environment | LegacyEnvironment;

export function normalizeEnvironment(input: string | null | undefined): Environment {
  const value = (input || "production").trim().toLowerCase();
  if (value === "preview") return "staging";
  if (value === "production" || value === "staging" || value === "development") return value;
  throw new Error(`Invalid environment "${input}". Must be one of: ${ENVIRONMENTS.join(", ")}`);
}

export function isEnvironment(input: string | null | undefined): input is EnvironmentInput {
  try {
    normalizeEnvironment(input);
    return true;
  } catch {
    return false;
  }
}
