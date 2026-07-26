import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { ProjectInfo } from "./prepare.service";
import { resolveFromReader } from "./prepare.service";
import { createLocalReader } from "./local-source";
import { parseGitRepositoryUrl } from "@repo/core";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 60_000;

function sanitizeGitUrl(raw: string): string {
  const value = raw.trim();
  if (!value) throw new Error("url is required");

  if (/^https?:\/\//i.test(value) || /^ssh:\/\//i.test(value) || /^git@[^:]+:.+$/i.test(value)) {
    return value;
  }

  throw new Error("Only HTTPS or SSH Git URLs are supported");
}

function inferRepoMeta(repoUrl: string, provider?: string) {
  const parsed = parseGitRepositoryUrl(repoUrl, provider);
  if (parsed) return parsed;

  const path = repoUrl.match(/^git@([^:]+):(.+)$/i)?.[2] ?? repoUrl;
  const repo = basename(path).replace(/\.git$/i, "") || "repository";
  return {
    provider: "git" as const,
    host: "git",
    repo,
    fullName: repo,
    cloneUrl: repoUrl,
  };
}

async function git(args: string[], opts?: { cwd?: string }): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd: opts?.cwd,
    timeout: GIT_TIMEOUT_MS,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "/bin/echo",
    },
    maxBuffer: 1024 * 1024 * 4,
  });
  return stdout;
}

async function resolveDefaultBranch(repoUrl: string): Promise<string> {
  const out = await git(["ls-remote", "--symref", repoUrl, "HEAD"]).catch(() => "");
  const line = out.split(/\r?\n/).find((l) => l.startsWith("ref: refs/heads/"));
  return line?.replace(/^ref: refs\/heads\//, "").split(/\s+/)[0]?.trim() || "main";
}

async function listBranches(repoUrl: string): Promise<Array<{ name: string }>> {
  const out = await git(["ls-remote", "--heads", repoUrl]).catch(() => "");
  return out
    .split(/\r?\n/)
    .map((line) => line.match(/refs\/heads\/(.+)$/)?.[1])
    .filter((name): name is string => !!name)
    .map((name) => ({ name }));
}

export async function resolveFromGitUrl(
  repoUrlInput: string,
  branch?: string,
  provider?: string,
): Promise<ProjectInfo> {
  const repoUrl = sanitizeGitUrl(repoUrlInput);
  const defaultBranch = await resolveDefaultBranch(repoUrl);
  const selectedBranch = branch?.trim() || defaultBranch;
  const branches = await listBranches(repoUrl);
  const dir = await mkdtemp(join(tmpdir(), "opsh-git-prepare-"));

  try {
    await git(["clone", "--depth", "1", "--branch", selectedBranch, repoUrl, dir]);
    const reader = createLocalReader(dir);
    const meta = inferRepoMeta(repoUrl, provider);
    return resolveFromReader(
      reader,
      {
        name: meta.repo,
        full_name: meta.fullName,
        owner: meta.owner ?? meta.host,
        private: true,
        default_branch: defaultBranch,
        selected_branch: selectedBranch,
        clone_url: repoUrl,
        html_url: meta.htmlUrl,
        provider: meta.provider,
        branches,
      },
      selectedBranch,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown git error";
    throw new Error(`Could not read Git repository: ${message}`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
