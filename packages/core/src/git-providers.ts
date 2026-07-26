export const GIT_PROVIDERS = [
  "github",
  "gitlab",
  "gitea",
  "heptapod",
  "bitbucket",
  "git",
] as const;

export type GitProvider = (typeof GIT_PROVIDERS)[number];

export interface GitRepositoryIdentity {
  provider: GitProvider;
  host: string;
  owner?: string;
  repo: string;
  fullName: string;
  cloneUrl: string;
  htmlUrl?: string;
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function providerFromHost(host: string): GitProvider {
  const lower = host.toLowerCase();
  if (lower === "github.com" || lower.endsWith(".github.com")) return "github";
  if (lower === "gitlab.com" || lower.endsWith(".gitlab.com")) return "gitlab";
  if (lower === "bitbucket.org" || lower.endsWith(".bitbucket.org")) return "bitbucket";
  if (lower === "heptapod.net" || lower.endsWith(".heptapod.net")) return "heptapod";
  if (lower.includes("gitea")) return "gitea";
  return "git";
}

function normalizeProvider(provider?: string | null, host?: string): GitProvider {
  const value = provider?.trim().toLowerCase();
  if (value && (GIT_PROVIDERS as readonly string[]).includes(value)) {
    return value as GitProvider;
  }
  return host ? providerFromHost(host) : "git";
}

function identityFromParts(
  cloneUrl: string,
  host: string,
  rawPath: string,
  provider?: string | null,
  protocol?: string,
): GitRepositoryIdentity {
  const parts = rawPath.split("/").filter(Boolean).map(decodeURIComponent);
  const repo = stripGitSuffix(parts.at(-1) || "repository");
  const owner = parts.length > 1 ? parts.at(-2) : undefined;
  const fullName = owner ? `${owner}/${repo}` : `${host}/${repo}`;
  const htmlUrl =
    protocol === "http:" || protocol === "https:"
      ? `${protocol}//${host}/${parts.map(encodeURIComponent).join("/")}`
      : undefined;

  return {
    provider: normalizeProvider(provider, host),
    host,
    owner,
    repo,
    fullName,
    cloneUrl,
    ...(htmlUrl && { htmlUrl }),
  };
}

export function parseGitRepositoryUrl(
  rawUrl: string,
  provider?: string | null,
): GitRepositoryIdentity | null {
  const cloneUrl = rawUrl.trim();
  if (!cloneUrl) return null;

  try {
    const url = new URL(cloneUrl);
    if (!["http:", "https:", "ssh:"].includes(url.protocol)) return null;
    return identityFromParts(cloneUrl, url.host, url.pathname, provider, url.protocol);
  } catch {
    const scp = cloneUrl.match(/^git@([^:]+):(.+)$/i);
    if (!scp) return null;
    return identityFromParts(cloneUrl, scp[1], scp[2], provider);
  }
}

export function isGitProvider(provider?: string | null): provider is GitProvider {
  return !!provider && (GIT_PROVIDERS as readonly string[]).includes(provider);
}

export function isGitHubProvider(provider?: string | null): boolean {
  return !provider || provider === "github";
}
