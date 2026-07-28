import { ForbiddenError, ValidationError, updateSourceConfig } from "@repo/core";
import { repos, type Project } from "@repo/db";
import { createHostExecutor } from "@repo/adapters";

import { env } from "../../config/env";
import type { RequestContext } from "../../lib/request-context";
import { readApiVersion, resolveLatestUpdateSourceReleaseTag } from "../../lib/release-resolver";

function sq(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function cleanRegistry(value: string): string {
  return value.trim().replace(/\/+$/g, "");
}

function cleanTag(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^v/, "") || "latest";
}

async function effectiveUpdateSource() {
  const settings = await repos.instanceSettings.get().catch(() => undefined);
  return updateSourceConfig({
    repo: settings?.updateRepo || env.OPENSHIP_UPDATE_REPO,
    branch: settings?.updateBranch || env.OPENSHIP_UPDATE_BRANCH,
    channel: settings?.updateChannel || env.OPENSHIP_UPDATE_CHANNEL,
    imageRegistry: settings?.updateImageRegistry || env.OPENSHIP_IMAGE_REGISTRY,
    version: settings?.updateVersion || env.OPENSHIP_VERSION || readApiVersion(),
  });
}

async function resolveTargetTag(explicitLatest?: string | null): Promise<string> {
  const source = await effectiveUpdateSource();
  if (source.channel === "docker" && source.version) return cleanTag(source.version);
  const latest =
    explicitLatest || (await resolveLatestUpdateSourceReleaseTag(source).catch(() => null));
  return cleanTag(latest || source.version || readApiVersion());
}

export interface SelfUpdateResult {
  success: true;
  project_id: string;
  deployment_id: null;
  self_update: true;
  logPath: string;
  composeDir: string;
  images: {
    api: string;
    dashboard: string;
    edge: string;
  };
}

/**
 * Apply an Openship control-plane update from outside the normal deploy pipeline.
 *
 * The API process cannot safely redeploy itself. Instead, this writes a Compose
 * override pointing api/dashboard/edge at the configured update registry+tag and
 * starts a detached host-side shell that pulls and recreates only those services.
 * The HTTP request can return before the API is restarted.
 */
export async function applySelfUpdate(
  ctx: RequestContext,
  project: Project,
  opts?: { latestVersion?: string | null },
): Promise<SelfUpdateResult> {
  if (project.appTemplateId !== "openship") {
    throw new ValidationError("Self-update can only be applied to the Openship project.");
  }
  if (env.CLOUD_MODE || env.DEPLOY_MODE !== "docker") {
    throw new ForbiddenError(
      "Openship self-update is only available for self-hosted Docker installs.",
    );
  }

  const source = await effectiveUpdateSource();
  if (source.channel !== "docker") {
    throw new ValidationError(
      "Set Update channel to 'docker' before applying a control-plane self-update.",
    );
  }

  const registry = cleanRegistry(source.imageRegistry);
  if (!registry) {
    throw new ValidationError("Docker registry is required for control-plane self-update.");
  }

  const tag = await resolveTargetTag(opts?.latestVersion);
  const images = {
    api: `${registry}/openship-api:${tag}`,
    dashboard: `${registry}/openship-dashboard:${tag}`,
    edge: `${registry}/openship-edge:${tag}`,
  };

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const logPath = `/tmp/openship-self-update-${stamp}.log`;
  const executor = createHostExecutor();

  const script = `
set -eu
configured_dir=${sq(process.env.OPENSHIP_SELF_UPDATE_COMPOSE_DIR ?? "")}
compose_dir=""
for candidate in "$configured_dir" "/opt/docker/openship" "$HOME/.openship/compose"; do
  [ -n "$candidate" ] || continue
  if [ -f "$candidate/docker-compose.yml" ] || [ -f "$candidate/compose.yml" ]; then
    compose_dir="$candidate"
    break
  fi
done
[ -n "$compose_dir" ] || { echo "No Openship compose directory found. Set OPENSHIP_SELF_UPDATE_COMPOSE_DIR."; exit 2; }
compose_file="$compose_dir/docker-compose.yml"
[ -f "$compose_file" ] || compose_file="$compose_dir/compose.yml"
docker compose -f "$compose_file" config --services | grep -qx api
docker compose -f "$compose_file" config --services | grep -qx dashboard
docker compose -f "$compose_file" config --services | grep -qx edge
lock_dir="/tmp/openship-self-update.lock"
if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "Another Openship self-update is already running."
  exit 3
fi
override_file="$compose_dir/docker-compose.openship-self-update.yml"
cat > "$override_file" <<'YAML'
services:
  api:
    image: ${images.api}
  dashboard:
    image: ${images.dashboard}
  edge:
    image: ${images.edge}
YAML
runner="/tmp/openship-self-update-${stamp}.sh"
cat > "$runner" <<'SH'
#!/bin/sh
set -eu
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
cd "$COMPOSE_DIR"
{
  echo "[openship-self-update] started $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[openship-self-update] compose_dir=$COMPOSE_DIR"
  echo "[openship-self-update] api=$IMG_API"
  echo "[openship-self-update] dashboard=$IMG_DASHBOARD"
  echo "[openship-self-update] edge=$IMG_EDGE"
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" pull api dashboard edge
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" up -d --no-deps --force-recreate api dashboard edge
  echo "[openship-self-update] containers recreated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps api dashboard edge
  for i in $(seq 1 36); do
    status=$(docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps --format json api 2>/dev/null || true)
    echo "$status" | grep -q '"Health":"healthy"' && break
    echo "[openship-self-update] waiting for api health ($i/36)"
    sleep 5
  done
  status=$(docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" ps --format json api 2>/dev/null || true)
  echo "$status" | grep -q '"Health":"healthy"' || {
    echo "[openship-self-update] api did not become healthy"
    exit 4
  }
  echo "[openship-self-update] done $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$LOG_PATH" 2>&1
SH
chmod 700 "$runner"
nohup env \\
  COMPOSE_DIR="$compose_dir" \\
  COMPOSE_FILE="$compose_file" \\
  OVERRIDE_FILE="$override_file" \\
  LOCK_DIR="$lock_dir" \\
  LOG_PATH=${sq(logPath)} \\
  IMG_API=${sq(images.api)} \\
  IMG_DASHBOARD=${sq(images.dashboard)} \\
  IMG_EDGE=${sq(images.edge)} \\
  "$runner" >/dev/null 2>&1 &
echo "$compose_dir"
`;

  const composeDir =
    (await executor.exec(script, { timeout: 30_000 })).trim().split(/\n/).pop() || "";

  await repos.updateStatus.upsert({
    organizationId: ctx.organizationId,
    projectId: project.id,
    kind: "release",
    behind: true,
    latestInProgress: true,
    currentLabel: readApiVersion(),
    latestLabel: tag,
    detail: {
      selfUpdate: true,
      source: {
        provider: source.provider,
        repo: source.repo,
        repoUrl: source.repoUrl,
        imageRegistry: source.imageRegistry,
        version: tag,
      },
      images,
      logPath,
      composeDir,
    },
    checkedAt: new Date(),
  });

  return {
    success: true,
    project_id: project.id,
    deployment_id: null,
    self_update: true,
    logPath,
    composeDir,
    images,
  };
}
