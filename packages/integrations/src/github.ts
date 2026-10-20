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
  const value = input.trim().replace(/\.git$/, "");

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    const [owner, repo] = value.split("/");
    return { owner, repo, fullName: `${owner}/${repo}` };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a GitHub repository as owner/repo or a github.com URL.");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Repository URL must point to github.com.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("GitHub repository URL must include owner and repository name.");
  }

  const [owner, repo] = parts;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export class GitHubRepositoryProvider {
  constructor(
    private readonly token = process.env.GITHUB_TOKEN,
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
    });

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      let detail = "";
      try {
        const payload = (await response.json()) as { message?: string };
        detail = payload.message ? `: ${payload.message}` : "";
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
      }>
    >(
      `/repos/${ref.owner}/${ref.repo}/pulls?state=all&sort=updated&direction=desc&per_page=${maxPullRequests}`,
    );

    const enrichedPulls = await Promise.all(
      pulls.slice(0, maxPullRequests).map(async (pull) => {
        try {
          const files = await this.request<Array<{ filename: string }>>(
            `/repos/${ref.owner}/${ref.repo}/pulls/${pull.number}/files?per_page=100`,
          );
          return { pull, files: files.map((file) => file.filename) };
        } catch {
          return { pull, files: [] as string[] };
        }
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
        date: item.commit.author?.date ?? null,
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
        files,
      })),
      fetchedAt: new Date().toISOString(),
    };
  }
}
