import { beforeEach, describe, expect, it, vi } from "vitest";

const projectRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  listByGroup: vi.fn(),
};

const projectGroupRepo = {
  update: vi.fn(),
};

vi.mock("@repo/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/db")>();
  return {
    ...actual,
    repos: {
      ...actual.repos,
      project: projectRepo,
      projectGroup: projectGroupRepo,
    },
  };
});

describe("linkProjectRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRepo.findById.mockResolvedValue({
      id: "proj_1",
      organizationId: "org_1",
      groupId: "group_1",
    });
    projectRepo.listByGroup.mockResolvedValue([
      { id: "proj_1", organizationId: "org_1", groupId: "group_1" },
      { id: "proj_2", organizationId: "org_1", groupId: "group_1" },
    ]);
    projectRepo.update.mockResolvedValue({});
    projectGroupRepo.update.mockResolvedValue({});
  });

  it("links a generic Git URL without requiring GitHub webhooks", async () => {
    const { linkProjectRepo } = await import("./project-crud.service");

    const result = await linkProjectRepo(
      { organizationId: "org_1", userId: "user_1" } as any,
      "proj_1",
      {
        gitUrl: "https://gitea.example.com/acme/service.git",
        gitProvider: "gitea",
        branch: "develop",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      owner: "acme",
      repo: "service",
      branch: "develop",
      provider: "gitea",
      gitUrl: "https://gitea.example.com/acme/service.git",
      strategy: "none",
      autoDeploy: false,
    });
    expect(projectRepo.update).toHaveBeenCalledWith(
      "proj_1",
      expect.objectContaining({
        gitProvider: "gitea",
        gitOwner: "acme",
        gitRepo: "service",
        gitBranch: "develop",
        webhookId: null,
        autoDeploy: false,
      }),
    );
    expect(projectGroupRepo.update).toHaveBeenCalledWith(
      "group_1",
      expect.objectContaining({
        gitProvider: "gitea",
        gitOwner: "acme",
        gitRepo: "service",
        installationId: null,
      }),
    );
    expect(projectRepo.update).toHaveBeenCalledWith(
      "proj_2",
      expect.objectContaining({
        gitProvider: "gitea",
        gitOwner: "acme",
        gitRepo: "service",
        webhookId: null,
        autoDeploy: false,
      }),
    );
  });
});
