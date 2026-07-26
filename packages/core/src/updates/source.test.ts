import { describe, expect, it } from "vitest";

import {
  advisoryManifestUrl,
  changelogUrl,
  normalizeGithubRepo,
  releasesLatestApi,
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
      branch: "main",
      channel: "docker",
      imageRegistry: "ghcr.io/joseagrc",
      version: "0.3.0",
      repoUrl: "https://github.com/joseagrc/openship",
      releasesUrl: "https://github.com/joseagrc/openship/releases",
    });
  });
});
