"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ArrowRight } from "lucide-react";
import { encodeGitSlug, encodeRepoSlug } from "@/utils/repoSlug";
import { useI18n } from "@/components/i18n-provider";
import { parseGitRepositoryUrl, type GitProvider } from "@repo/core";

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
  return match ? { owner: match[1]!, repo: match[2]! } : null;
}

function isGitUrl(url: string): boolean {
  return /^https?:\/\/.+/i.test(url) || /^ssh:\/\/.+/i.test(url) || /^git@[^:]+:.+$/i.test(url);
}

export function UrlImport() {
  const { t } = useI18n();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<GitProvider | "auto">("auto");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = url.trim();
    if (!isGitUrl(trimmed)) {
      setError(t.library.urlImport.invalidUrl);
      return;
    }

    const parsed = parseGitRepositoryUrl(trimmed, provider === "auto" ? undefined : provider);
    const resolvedProvider = provider === "auto" ? parsed?.provider : provider;
    const github = resolvedProvider === "github" ? parseGithubUrl(trimmed) : null;
    const slug = github
      ? encodeRepoSlug(github.owner, github.repo)
      : encodeGitSlug(trimmed, undefined, resolvedProvider && resolvedProvider !== "git" ? resolvedProvider : undefined);
    router.push(`/deploy/${slug}`);
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50">
      <div className="p-8">
        <div className="max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
            <Link2 className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground text-center mb-1.5">
            {t.library.urlImport.title}
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
            {t.library.urlImport.description}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="https://git.example.com/group/repository.git"
                className={`w-full px-4 py-3 bg-background border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? "border-danger-border focus:ring-danger-border"
                    : "border-border/50 focus:ring-primary/20"
                }`}
              />
              {error && (
                <p className="text-xs text-danger mt-1.5">{error}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Git provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as GitProvider | "auto")}
                className="w-full px-4 py-3 bg-background border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="auto">Auto detect</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="gitea">Gitea</option>
                <option value="heptapod">Heptapod</option>
                <option value="bitbucket">Bitbucket</option>
                <option value="git">Other Git</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background text-sm font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.library.urlImport.importButton}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
