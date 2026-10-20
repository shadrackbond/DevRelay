import {
  GitHubApiError,
  parseGitHubRepository,
} from "./github";

export interface GitHubWorkflowRunSummary {
  id: number;
  name: string;
  event: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  headBranch: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  jobs: GitHubWorkflowJobSummary[];
}

export interface GitHubWorkflowJobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string;
  steps: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    number: number;
  }>;
}

export interface GitHubActionsSnapshot {
  repository: string;
  runs: GitHubWorkflowRunSummary[];
  fetchedAt: string;
}

export class GitHubActionsProvider {
  constructor(
    private readonly token?: string,
    private readonly apiBase = "https://api.github.com",
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DevRelay-CI-Agent",
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
        `GitHub Actions request failed (${response.status})${detail}`,
        response.status,
        remaining,
      );
    }

    return (await response.json()) as T;
  }

  async inspect(
    repositoryInput: string,
    options?: { maxRuns?: number },
  ): Promise<GitHubActionsSnapshot> {
    const ref = parseGitHubRepository(repositoryInput);
    const maxRuns = Math.min(options?.maxRuns ?? 20, 50);

    const payload = await this.request<{
      workflow_runs: Array<{
        id: number;
        name: string;
        event: string;
        status: string;
        conclusion: string | null;
        head_sha: string;
        head_branch: string | null;
        created_at: string;
        updated_at: string;
        html_url: string;
      }>;
    }>(
      `/repos/${ref.owner}/${ref.repo}/actions/runs?per_page=${maxRuns}`,
    );

    const runs = await Promise.all(
      payload.workflow_runs.slice(0, maxRuns).map(async (run) => {
        let jobs: GitHubWorkflowJobSummary[] = [];

        try {
          const jobPayload = await this.request<{
            jobs: Array<{
              id: number;
              name: string;
              status: string;
              conclusion: string | null;
              started_at: string | null;
              completed_at: string | null;
              html_url: string;
              steps?: Array<{
                name: string;
                status: string;
                conclusion: string | null;
                number: number;
              }>;
            }>;
          }>(
            `/repos/${ref.owner}/${ref.repo}/actions/runs/${run.id}/jobs?per_page=100`,
          );

          jobs = jobPayload.jobs.map((job) => ({
            id: job.id,
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            htmlUrl: job.html_url,
            steps: (job.steps ?? []).map((step) => ({
              name: step.name,
              status: step.status,
              conclusion: step.conclusion,
              number: step.number,
            })),
          }));
        } catch {
          jobs = [];
        }

        return {
          id: run.id,
          name: run.name,
          event: run.event,
          status: run.status,
          conclusion: run.conclusion,
          headSha: run.head_sha,
          headBranch: run.head_branch,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          htmlUrl: run.html_url,
          jobs,
        };
      }),
    );

    return {
      repository: ref.fullName,
      runs,
      fetchedAt: new Date().toISOString(),
    };
  }
}
