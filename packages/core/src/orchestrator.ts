import type { DevRelayAgent } from "./agents/base";
import type { Evidence, Incident } from "./types";

export interface OrchestrationResult {
  evidence: Evidence[];
  notes: Record<string, string[]>;
}

export class IncidentOrchestrator {
  constructor(private readonly agents: DevRelayAgent[]) {}

  async investigate(incident: Incident): Promise<OrchestrationResult> {
    const notes: Record<string, string[]> = {};
    const evidence: Evidence[] = [];

    for (const agent of this.agents) {
      const result = await agent.investigate({
        incident,
        availableEvidence: [...evidence],
      });

      evidence.push(...result.evidence);
      notes[result.agent] = result.notes;
    }

    return { evidence: dedupeEvidence(evidence), notes };
  }
}

function dedupeEvidence(items: Evidence[]): Evidence[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
