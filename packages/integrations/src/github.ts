export interface GitHubRepositoryRef {
  owner: string;
  repo: string;
  fullName: string;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  htmlUrl: string;
}

export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  mergedAt: string | null;
  updatedAt: string;
  htmlUrl: string;
  headSha: string;
  mergeCommitSha: string | null;
  files: string[];
}

export interface GitHubRepositorySnapshot {
  repository: {
    fullName: string;
    defaultBranch: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
  };
  commits: GitHubCommitSummary[];
  pullRequests: GitHubPullRequestSummary[];
  fetchedAt: string;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitRemaining?: string | null,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function parseGitHubRepository(input: string): GitHubRepositoryRef {
  let value = input.trim();
  if (value.includes(":")) {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname) ||
        url.port || url.username || url.password || url.search || url.hash) {
      throw new Error("Repository URL must be an HTTPS github.com repository URL.");
    }
    value = url.pathname.slice(1);
  }

  value = value.replace(/\/$/, "").replace(/\.git$/, "");
  const match = /^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo || repo === "." || repo === "..") {
    throw new Error("Enter a GitHub repository as owner/repo or an HTTPS github.com repository URL.");
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export class GitHubRepositoryProvider {
  constructor(
    private readonly token?: string,
    private readonly apiBase = "https://api.github.com",
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DevRelay-Repository-Agent",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      let detail = "";
      try {
        const payload = (await response.json()) as { message?: string };
        detail = typeof payload.message === "string" ? `: ${payload.message}` : "";
      } catch {
        // Ignore malformed GitHub error bodies.
      }

      throw new GitHubApiError(
        `GitHub request failed (${response.status})${detail}`,
        response.status,
        remaining,
      );
    }

    return (await response.json()) as T;
  }

  async inspect(
    repositoryInput: string,
    options?: { since?: string; maxCommits?: number; maxPullRequests?: number },
  ): Promise<GitHubRepositorySnapshot> {
    const ref = parseGitHubRepository(repositoryInput);
    for (const value of [options?.maxCommits, options?.maxPullRequests]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
        throw new Error("GitHub result limits must be positive integers.");
      }
    }
    if (options?.since && !Number.isFinite(Date.parse(options.since))) {
      throw new Error("GitHub since must be a valid timestamp.");
    }
    const maxCommits = Math.min(options?.maxCommits ?? 12, 30);
    const maxPullRequests = Math.min(options?.maxPullRequests ?? 8, 20);

    const metadata = await this.request<{
      full_name: string;
      default_branch: string;
      description: string | null;
      private: boolean;
      html_url: string;
    }>(`/repos/${ref.owner}/${ref.repo}`);

    const commitQuery = new URLSearchParams({
      per_page: String(maxCommits),
      ...(options?.since ? { since: options.since } : {}),
    });

    const commits = await this.request<
      Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { name: string; date: string } | null;
          committer: { date: string } | null;
        };
        author: { login: string } | null;
      }>
    >(`/repos/${ref.owner}/${ref.repo}/commits?${commitQuery.toString()}`);

    const pulls = await this.request<
      Array<{
        number: number;
        title: string;
        body: string | null;
        state: string;
        merged_at: string | null;
        updated_at: string;
        html_url: string;
        head: { sha: string };
        merge_commit_sha: string | null;
      }>
    >(
      `/repos/${ref.owner}/${ref.repo}/pulls?state=all&sort=updated&direction=desc&per_page=${maxPullRequests}`,
    );

    const enrichedPulls = await Promise.all(
      pulls.slice(0, maxPullRequests).map(async (pull) => {
        const files: string[] = [];
        for (let page = 1; page <= 30; page += 1) {
          const batch = await this.request<Array<{ filename: string }>>(
            `/repos/${ref.owner}/${ref.repo}/pulls/${pull.number}/files?per_page=100&page=${page}`,
          );
          files.push(...batch.map((file) => file.filename));
          if (batch.length < 100) return { pull, files };
        }
        throw new Error(`PR #${pull.number} reached GitHub's 3,000-file limit; changed-file evidence may be incomplete.`);
      }),
    );

    return {
      repository: {
        fullName: metadata.full_name,
        defaultBranch: metadata.default_branch,
        description: metadata.description,
        private: metadata.private,
        htmlUrl: metadata.html_url,
      },
      commits: commits.map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        author: item.author?.login ?? item.commit.author?.name ?? null,
        date: item.commit.committer?.date ?? item.commit.author?.date ?? null,
        htmlUrl: item.html_url,
      })),
      pullRequests: enrichedPulls.map(({ pull, files }) => ({
        number: pull.number,
        title: pull.title,
        body: pull.body ?? "",
        state: pull.state,
        mergedAt: pull.merged_at,
        updatedAt: pull.updated_at,
        htmlUrl: pull.html_url,
        headSha: pull.head.sha,
        mergeCommitSha: pull.merge_commit_sha,
        files,
      })),
      fetchedAt: new Date().toISOString(),
    };
  }
}
