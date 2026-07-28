import { describe, expect, it } from "vitest";

import {
  advisoryManifestUrl,
  changelogUrl,
  normalizeGithubRepo,
  normalizeUpdateRepository,
  releasesLatestApi,
  updateSourceAdvisoryManifestUrl,
  updateSourceConfig,
} from "./types";

describe("update source helpers", () => {
  it("normalizes owner/repo and GitHub URLs", () => {
    expect(normalizeGithubRepo("joseagrc/openship")).toBe("joseagrc/openship");
    expect(normalizeGithubRepo("https://github.com/joseagrc/openship.git")).toBe(
      "joseagrc/openship",
    );
    expect(normalizeGithubRepo("")).toBe("oblien/openship");
  });

  it("keeps non-GitHub VCS repository URLs instead of falling back", () => {
    expect(
      normalizeUpdateRepository("https://gitea.joseagrc.com/solutema/openship.git"),
    ).toMatchObject({
      provider: "gitea",
      repo: "gitea.joseagrc.com/solutema/openship",
      repoUrl: "https://gitea.joseagrc.com/solutema/openship",
      releasesApiUrl:
        "https://gitea.joseagrc.com/api/v1/repos/solutema/openship/releases/latest",
      releasesUrl: "https://gitea.joseagrc.com/solutema/openship/releases",
    });

    expect(normalizeUpdateRepository("https://gitlab.com/acme/platform.git")).toMatchObject({
      provider: "gitlab",
      repo: "gitlab.com/acme/platform",
      releasesApiUrl:
        "https://gitlab.com/api/v4/projects/acme%2Fplatform/releases/permalink/latest",
      releasesUrl: "https://gitlab.com/acme/platform/-/releases",
    });

    expect(normalizeUpdateRepository("https://git.example.com/acme/platform.git")).toMatchObject({
      provider: "generic",
      repo: "git.example.com/acme/platform",
      releasesApiUrl: null,
      releasesUrl: "https://git.example.com/acme/platform",
    });
  });

  it("builds release, advisory, and changelog URLs for a fork", () => {
    expect(releasesLatestApi("joseagrc/openship")).toBe(
      "https://api.github.com/repos/joseagrc/openship/releases/latest",
    );
    expect(advisoryManifestUrl("v1.2.3", "joseagrc/openship")).toBe(
      "https://raw.githubusercontent.com/joseagrc/openship/v1.2.3/release-advisories.json",
    );
    expect(changelogUrl("v1.2.3", "joseagrc/openship")).toBe(
      "https://github.com/joseagrc/openship/releases/tag/v1.2.3",
    );
  });

  it("builds advisory manifest URLs for known self-hosted providers", () => {
    const gitea = normalizeUpdateRepository("https://gitea.example.com/org/repo.git");
    expect(updateSourceAdvisoryManifestUrl("v1.2.3", gitea)).toBe(
      "https://gitea.example.com/org/repo/raw/tag/v1.2.3/release-advisories.json",
    );

    const generic = normalizeUpdateRepository("https://git.example.com/org/repo.git");
    expect(updateSourceAdvisoryManifestUrl("v1.2.3", generic)).toBe(null);
  });

  it("returns a complete runtime update source config", () => {
    expect(
      updateSourceConfig({
        repo: "https://github.com/joseagrc/openship.git",
        branch: "main",
        channel: "docker",
        imageRegistry: "ghcr.io/joseagrc",
        version: "0.3.0",
      }),
    ).toMatchObject({
      repo: "joseagrc/openship",
      provider: "github",
      branch: "main",
      channel: "docker",
      imageRegistry: "ghcr.io/joseagrc",
      version: "0.3.0",
      repoUrl: "https://github.com/joseagrc/openship",
      releasesUrl: "https://github.com/joseagrc/openship/releases",
    });
  });
});
