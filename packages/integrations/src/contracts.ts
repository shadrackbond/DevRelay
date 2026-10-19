export interface RepositoryProvider {
  getPullRequest(id: string): Promise<unknown>;
  getRecentChanges(service?: string): Promise<unknown[]>;
}

export interface LogProvider {
  query(input: { service?: string; from: string; to: string; contains?: string }): Promise<unknown[]>;
}

export interface CiProvider {
  getRecentRuns(ref?: string): Promise<unknown[]>;
}

export interface MonitoringProvider {
  getServiceHealth(service: string): Promise<unknown>;
}

export interface DatabaseProvider {
  inspectHealth(): Promise<unknown>;
}

export interface DevRelayIntegrations {
  repository?: RepositoryProvider;
  logs?: LogProvider;
  ci?: CiProvider;
  monitoring?: MonitoringProvider;
  database?: DatabaseProvider;
}
