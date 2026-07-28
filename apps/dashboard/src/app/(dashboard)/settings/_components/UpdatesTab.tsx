"use client";

/**
 * Settings → Updates. Update/advisory status + user controls, for the desktop
 * app and self-hosted servers. Security posture is explicit: auto-update is OFF
 * by default, notifications can be muted, and everything is pulled from GitHub
 * only (see the disclosure) — nothing pushes to the install.
 */

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  Download,
  Github,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import { useUpdates } from "@/components/updates/useUpdates";
import { useI18n, interpolate } from "@/components/i18n-provider";
import { getApiErrorMessage } from "@/lib/api/client";
import { settingsApi, type UpdateSourceOverrides } from "@/lib/api/settings";

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
            checked
              ? "translate-x-[22px] rtl:-translate-x-[22px]"
              : "translate-x-0.5 rtl:-translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function UpdatesTab() {
  const { t } = useI18n();
  const { state, muted, desktop, updateSource, setMuted, startDesktopUpdate, refresh } =
    useUpdates();
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sourceForm, setSourceForm] = useState<UpdateSourceOverrides>({
    repo: null,
    branch: null,
    channel: null,
    imageRegistry: null,
    version: null,
  });
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const releasesUrl = updateSource?.releasesUrl ?? "https://github.com/oblien/openship/releases";
  const repoUrl = updateSource?.repoUrl ?? "https://github.com/oblien/openship";
  const repoLabel = updateSource?.repoUrl?.replace(/^https?:\/\//, "") ?? "github.com/oblien/openship";

  useEffect(() => {
    if (!desktop) return;
    void window.desktop?.config
      ?.get<boolean | undefined>("autoUpdate")
      .then((v) => setAutoUpdate(v === true))
      .catch(() => {});
  }, [desktop]);

  useEffect(() => {
    let alive = true;
    settingsApi
      .getUpdateSource()
      .then((res) => {
        if (!alive) return;
        setSourceForm(res.overrides);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const toggleAuto = useCallback((v: boolean) => {
    setAutoUpdate(v);
    void window.desktop?.config?.set("autoUpdate", v);
  }, []);

  const checkNow = useCallback(() => {
    setChecking(true);
    refresh();
    setTimeout(() => setChecking(false), 1200);
  }, [refresh]);

  const setSourceField = useCallback((key: keyof UpdateSourceOverrides, value: string) => {
    setSourceForm((cur) => ({ ...cur, [key]: value.trim() ? value : null }));
    setSourceMessage(null);
    setSourceError(null);
  }, []);

  const saveUpdateSource = useCallback(async () => {
    setSourceSaving(true);
    setSourceMessage(null);
    setSourceError(null);
    try {
      await settingsApi.updateUpdateSource(sourceForm);
      setSourceMessage("Saved. Reloading update source...");
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setSourceError(getApiErrorMessage(err, "Could not save update source"));
    } finally {
      setSourceSaving(false);
    }
  }, [sourceForm]);

  const upToDate = state && !state.updateAvailable;

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={RefreshCw}
        title={t.settings.updates.title}
        description={t.settings.updates.description}
      >
        {/* Status */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-9 items-center justify-center rounded-xl ${upToDate ? "bg-success-bg text-success" : "bg-primary/10 text-primary"}`}
            >
              {upToDate ? (
                <CheckCircle2 className="size-[18px]" />
              ) : (
                <Download className="size-[18px]" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-medium text-foreground">
                {!state
                  ? t.settings.updates.checking
                  : state.updateAvailable
                    ? interpolate(t.settings.updates.available, {
                        version: state.latestVersion ?? "",
                      })
                    : t.settings.updates.upToDate}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {state?.currentVersion
                  ? interpolate(t.settings.updates.current, { version: state.currentVersion })
                  : ""}
                {state?.updateAvailable && !desktop ? t.settings.updates.rerunToUpdate : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state?.updateAvailable && desktop && (
              <button
                type="button"
                onClick={startDesktopUpdate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
              >
                <Download className="size-3.5" />
                {t.settings.updates.updateNow}
              </button>
            )}
            <button
              type="button"
              onClick={checkNow}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
            >
              {checking ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {t.settings.updates.checkNow}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 space-y-4">
          {desktop && (
            <Toggle
              checked={autoUpdate}
              onChange={toggleAuto}
              label={t.settings.updates.autoUpdateLabel}
              description={t.settings.updates.autoUpdateDesc}
            />
          )}
          <Toggle
            checked={!muted}
            onChange={(v) => setMuted(!v)}
            label={t.settings.updates.notificationsLabel}
            description={t.settings.updates.notificationsDesc}
          />
        </div>

        <a
          href={releasesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
        >
          <Github className="size-3.5" />
          {t.settings.updates.viewChangelog}
        </a>
      </SettingsSection>

      <SettingsSection
        icon={Github}
        title="Update Source"
        description="Choose where this self-hosted instance checks releases, advisories, and Docker images."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">VCS repository</span>
            <input
              value={sourceForm.repo ?? ""}
              onChange={(e) => setSourceField("repo", e.target.value)}
              placeholder="owner/repo or https://gitea.example.com/org/repo.git"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/40"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Branch</span>
            <input
              value={sourceForm.branch ?? ""}
              onChange={(e) => setSourceField("branch", e.target.value)}
              placeholder="main"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/40"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Update channel</span>
            <select
              value={sourceForm.channel ?? ""}
              onChange={(e) => setSourceField("channel", e.target.value)}
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/40"
            >
              <option value="">Use server default</option>
              <option value="release">Release</option>
              <option value="docker">Docker</option>
              <option value="source">Source</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Docker registry</span>
            <input
              value={sourceForm.imageRegistry ?? ""}
              onChange={(e) => setSourceField("imageRegistry", e.target.value)}
              placeholder="ghcr.io/oblien"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/40"
            />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              Version / image tag
            </span>
            <input
              value={sourceForm.version ?? ""}
              onChange={(e) => setSourceField("version", e.target.value)}
              placeholder="latest, main, or v0.3.1"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none transition-colors focus:border-foreground/40"
            />
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[12.5px] text-muted-foreground">
          Effective source:{" "}
          <span className="font-medium text-foreground">
            {updateSource?.repoUrl ?? "https://github.com/oblien/openship"}
          </span>{" "}
          · {updateSource?.provider ?? "github"} · {updateSource?.channel ?? "release"} · {updateSource?.imageRegistry ?? "ghcr.io/oblien"}
          {updateSource?.version ? `:${updateSource.version}` : ""}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-h-5 text-[12.5px]">
            {sourceError && <span className="text-destructive">{sourceError}</span>}
            {sourceMessage && <span className="text-success">{sourceMessage}</span>}
          </div>
          <button
            type="button"
            onClick={saveUpdateSource}
            disabled={sourceSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {sourceSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save source
          </button>
        </div>
      </SettingsSection>

      {/* Security disclosure */}
      <SettingsSection
        icon={ShieldCheck}
        title={t.settings.updates.securityTitle}
        description={t.settings.updates.securityDescription}
        iconBg="bg-success-bg"
        iconColor="text-success"
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Openship pulls update metadata from the repository source configured above. Known
          providers can expose release and advisory checks; generic Git sources are retained for
          source/docker workflows but may not support automatic release discovery. Current source:{" "}
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            {repoLabel}
          </a>.
        </p>
      </SettingsSection>
    </div>
  );
}
