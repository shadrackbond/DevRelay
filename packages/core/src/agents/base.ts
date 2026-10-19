import type { Evidence, Incident } from "../types";

export interface AgentContext {
  incident: Incident;
  availableEvidence: Evidence[];
  signal?: AbortSignal;
}

export interface AgentResult {
  agent: string;
  evidence: Evidence[];
  notes: string[];
}

export interface DevRelayAgent {
  readonly name: string;
  investigate(context: AgentContext): Promise<AgentResult>;
}

export abstract class BaseAgent implements DevRelayAgent {
  abstract readonly name: string;
  abstract investigate(context: AgentContext): Promise<AgentResult>;
}
