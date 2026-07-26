import { afterEach, describe, expect, it } from "vitest";

import {
  assetUrl,
  latestApiUrl,
  releaseRepo,
  RELEASES,
  releasesUrl,
  REPO,
} from "../../src/lib/github-releases";

const originalUpdateRepo = process.env.OPENSHIP_UPDATE_REPO;
const originalRepo = process.env.OPENSHIP_REPO;

afterEach(() => {
  if (originalUpdateRepo === undefined) delete process.env.OPENSHIP_UPDATE_REPO;
  else process.env.OPENSHIP_UPDATE_REPO = originalUpdateRepo;
  if (originalRepo === undefined) delete process.env.OPENSHIP_REPO;
  else process.env.OPENSHIP_REPO = originalRepo;
});

describe("github-releases constants", () => {
  it("points at the oblien/openship releases page", () => {
    expect(REPO).toBe("oblien/openship");
    expect(RELEASES).toBe("https://github.com/oblien/openship/releases");
  });
});

describe("assetUrl", () => {
  it("builds a release download URL from a tag + asset name", () => {
    delete process.env.OPENSHIP_UPDATE_REPO;
    delete process.env.OPENSHIP_REPO;
    expect(assetUrl("v1.2.3", "Openship-arm64.dmg")).toBe(
      "https://github.com/oblien/openship/releases/download/v1.2.3/Openship-arm64.dmg",
    );
  });

  it("uses the configured update repo for release assets", () => {
    process.env.OPENSHIP_UPDATE_REPO = "https://github.com/joseagrc/openship.git";
    expect(releaseRepo()).toBe("joseagrc/openship");
    expect(releasesUrl()).toBe("https://github.com/joseagrc/openship/releases");
    expect(latestApiUrl()).toBe("https://api.github.com/repos/joseagrc/openship/releases/latest");
    expect(assetUrl("v1.2.3", "Openship-arm64.dmg")).toBe(
      "https://github.com/joseagrc/openship/releases/download/v1.2.3/Openship-arm64.dmg",
    );
  });
});
