/**
 * Update & advisory types, shared by the desktop app and the dashboard.
 *
 * Advisories are pulled from the repo, but PINNED TO THE LATEST RELEASE TAG
 * (see `advisoryManifestUrl`) — never from `main` — so a push to main with no
 * new version can't change what any client sees. Clients only ever PULL from
 * the public GitHub repo; nothing pushes to them.
 */

export type AdvisorySeverity = "critical" | "recommended" | "info";

export interface AdvisoryAction {
  label: string;
  /**
   * How the banner's button behaves:
   *   - "update"        → drive the desktop native updater (desktop only).
   *   - "open-url"      → open `url` externally.
   *   - "update-entity" → web-safe update: the dashboard POSTs the apply
   *                       endpoint for `entityId` (an app/project/self-app),
   *                       then shows deploy progress. Used by the update
   *                       advisories the scanner synthesizes.
   */
  kind: "update" | "open-url" | "update-entity";
  url?: string;
  /** For "update-entity": the project/app id to apply the update to. */
  entityId?: string;
}

/** What an advisory is about — lets a notice/update target one app/project. */
export interface AdvisoryTarget {
  type: "platform" | "app" | "project" | "mail";
  /** Project/app id when scoped; omitted for platform-wide. */
  id?: string;
}

export interface Advisory {
  /** Stable id — used for per-advisory dismissal. */
  id: string;
  severity: AdvisorySeverity;
  /** Version range this targets, e.g. "<=0.1.8" or ">=0.1.0 <0.1.9". */
  affects: string;
  title: string;
  message: string;
  action?: AdvisoryAction;
  /** Optional scope. Absent = platform-wide (the legacy default). */
  target?: AdvisoryTarget;
}

export interface AdvisoryManifest {
  advisories: Advisory[];
}

export interface LatestRelease {
  /** Version without a leading "v", e.g. "0.1.9". */
  version: string;
  /** Raw tag, e.g. "v0.1.9". */
  tag: string;
  /** Release notes (markdown/plain) from the GitHub release body. */
  notes: string;
}

export interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  /** Advisories that apply to the current version, most severe first. */
  advisories: Advisory[];
  /** Link to all releases. */
  changelogUrl: string;
  /** Link to the latest release's notes (tag-specific), or all releases. */
  latestChangelogUrl: string;
}

export const DEFAULT_UPDATE_REPO = "oblien/openship";
export const DEFAULT_UPDATE_BRANCH = "main";
export const DEFAULT_IMAGE_REGISTRY = "ghcr.io/oblien";

export type UpdateChannel = "release" | "docker" | "source";
export type UpdateSourceProvider = "github" | "gitea" | "gitlab" | "generic";

export interface NormalizedUpdateRepository {
  /** Human-readable repository id. GitHub owner/repo stays backwards-compatible. */
  repo: string;
  provider: UpdateSourceProvider;
  host: string | null;
  path: string;
  owner: string | null;
  repoName: string | null;
  repoUrl: string;
  releasesApiUrl: string | null;
  releasesUrl: string;
}

export interface UpdateSourceConfig {
  /** Repository identifier or URL used for update checks and links. */
  repo: string;
  provider: UpdateSourceProvider;
  host: string | null;
  path: string;
  owner: string | null;
  repoName: string | null;
  /** Branch used by source installs and "view source" links. */
  branch: string;
  /** Preferred update mechanism for this install. */
  channel: UpdateChannel;
  /** Container registry namespace used by compose images. */
  imageRegistry: string;
  /** Running/pinned image or release version when known. */
  version: string | null;
  repoUrl: string;
  releasesApiUrl: string | null;
  releasesUrl: string;
  changelogUrl: string;
}

/** Backwards-compatible public constant for callers/tests that import REPO. */
export const GITHUB_REPO = DEFAULT_UPDATE_REPO;

function cleanPathPart(input: string): string {
  return input.trim().replace(/^\/+|\/+$/g, "");
}

function stripGitSuffix(input: string): string {
  return input.replace(/\.git$/i, "");
}

function inferProvider(host: string): UpdateSourceProvider {
  const lower = host.toLowerCase();
  if (lower === "github.com" || lower === "www.github.com") return "github";
  if (lower.includes("gitlab")) return "gitlab";
  if (lower.includes("gitea")) return "gitea";
  return "generic";
}

function repoPathParts(path: string): { owner: string | null; repoName: string | null } {
  const parts = cleanPathPart(stripGitSuffix(path)).split("/").filter(Boolean);
  if (parts.length < 2) return { owner: null, repoName: null };
  return {
    owner: parts.slice(0, -1).join("/"),
    repoName: parts[parts.length - 1] ?? null,
  };
}

function releaseApiUrl(provider: UpdateSourceProvider, host: string, path: string): string | null {
  const encodedPath = cleanPathPart(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (!encodedPath) return null;
  if (provider === "github") return `https://api.github.com/repos/${encodedPath}/releases/latest`;
  if (provider === "gitea") return `https://${host}/api/v1/repos/${encodedPath}/releases/latest`;
  if (provider === "gitlab")
    return `https://${host}/api/v4/projects/${encodeURIComponent(cleanPathPart(path))}/releases/permalink/latest`;
  return null;
}

export function normalizeUpdateRepository(input?: string | null): NormalizedUpdateRepository {
  const raw = (input ?? "").trim();
  if (!raw) return normalizeUpdateRepository(DEFAULT_UPDATE_REPO);

  const withoutGit = stripGitSuffix(raw);
  try {
    const url = new URL(withoutGit);
    const host = url.hostname.replace(/^www\./i, "");
    const provider = inferProvider(host);
    const path = cleanPathPart(url.pathname);
    const { owner, repoName } = repoPathParts(path);
    if (!path || !repoName) return normalizeUpdateRepository(DEFAULT_UPDATE_REPO);
    const repo = provider === "github" ? path : `${host}/${path}`;
    const repoUrl = `${url.protocol}//${host}/${path}`;
    const releasesUrl =
      provider === "gitlab" ? `${repoUrl}/-/releases` : provider === "generic" ? repoUrl : `${repoUrl}/releases`;
    return {
      repo,
      provider,
      host,
      path,
      owner,
      repoName,
      repoUrl,
      releasesApiUrl: releaseApiUrl(provider, host, path),
      releasesUrl,
    };
  } catch {
    const path = cleanPathPart(withoutGit);
    const { owner, repoName } = repoPathParts(path);
    if (!owner || !repoName) return normalizeUpdateRepository(DEFAULT_UPDATE_REPO);
    return {
      repo: path,
      provider: "github",
      host: "github.com",
      path,
      owner,
      repoName,
      repoUrl: `https://github.com/${path}`,
      releasesApiUrl: releaseApiUrl("github", "github.com", path),
      releasesUrl: `https://github.com/${path}/releases`,
    };
  }
}

export function normalizeGithubRepo(input?: string | null): string {
  const normalized = normalizeUpdateRepository(input);
  return normalized.provider === "github" ? normalized.path : DEFAULT_UPDATE_REPO;
}

export function normalizeUpdateChannel(input?: string | null): UpdateChannel {
  return input === "docker" || input === "source" || input === "release" ? input : "release";
}

export function githubRepoUrl(repo = DEFAULT_UPDATE_REPO): string {
  return normalizeUpdateRepository(repo).repoUrl;
}

/** GitHub API: the latest published (non-prerelease) release. */
export function releasesLatestApi(repo = DEFAULT_UPDATE_REPO): string {
  return `https://api.github.com/repos/${normalizeGithubRepo(repo)}/releases/latest`;
}

/** Backwards-compatible default latest-release endpoint. */
export const RELEASES_LATEST_API = releasesLatestApi();

/**
 * Raw advisory manifest URL, PINNED to a release tag. Because it's pinned to a
 * tag (not a branch), it only changes when a version is released — commits to
 * `main` are invisible to clients. Returns null for an empty tag.
 */
export function advisoryManifestUrl(tag: string, repo = DEFAULT_UPDATE_REPO): string {
  const source = normalizeUpdateRepository(repo);
  return updateSourceAdvisoryManifestUrl(tag, source) ?? "";
}

/** Human-facing changelog link — a specific tag's notes, or all releases. */
export function changelogUrl(tag?: string, repo = DEFAULT_UPDATE_REPO): string {
  const source = normalizeUpdateRepository(repo);
  return updateSourceChangelogUrl(tag, source);
}

export function updateSourceChangelogUrl(
  tag?: string,
  source: Pick<NormalizedUpdateRepository, "provider" | "repoUrl" | "releasesUrl"> = normalizeUpdateRepository(),
): string {
  if (!tag) return source.releasesUrl;
  const encoded = encodeURIComponent(tag);
  if (source.provider === "github" || source.provider === "gitea")
    return `${source.repoUrl}/releases/tag/${encoded}`;
  if (source.provider === "gitlab") return `${source.repoUrl}/-/releases/${encoded}`;
  return source.repoUrl;
}

export function updateSourceAdvisoryManifestUrl(
  tag: string,
  source: Pick<NormalizedUpdateRepository, "provider" | "host" | "path" | "repoUrl">,
): string | null {
  if (!tag) return null;
  const encodedTag = encodeURIComponent(tag);
  const encodedPath = source.path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (source.provider === "github")
    return `https://raw.githubusercontent.com/${encodedPath}/${encodedTag}/release-advisories.json`;
  if (source.provider === "gitea") return `${source.repoUrl}/raw/tag/${encodedTag}/release-advisories.json`;
  if (source.provider === "gitlab") return `${source.repoUrl}/-/raw/${encodedTag}/release-advisories.json`;
  return null;
}

export function updateSourceConfig(
  input?: Partial<{
    repo: string | null;
    branch: string | null;
    channel: string | null;
    imageRegistry: string | null;
    version: string | null;
  }>,
): UpdateSourceConfig {
  const source = normalizeUpdateRepository(input?.repo);
  const branch = (input?.branch ?? "").trim() || DEFAULT_UPDATE_BRANCH;
  const channel = normalizeUpdateChannel(input?.channel);
  const imageRegistry = (input?.imageRegistry ?? "").trim() || DEFAULT_IMAGE_REGISTRY;
  const version = (input?.version ?? "").trim() || null;
  return {
    repo: source.repo,
    provider: source.provider,
    host: source.host,
    path: source.path,
    owner: source.owner,
    repoName: source.repoName,
    branch,
    channel,
    imageRegistry,
    version,
    repoUrl: source.repoUrl,
    releasesApiUrl: source.releasesApiUrl,
    releasesUrl: source.releasesUrl,
    changelogUrl: updateSourceChangelogUrl(undefined, source),
  };
}
