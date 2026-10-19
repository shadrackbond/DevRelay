# DevRelay Architecture

## Design goal

DevRelay investigates an engineering incident across multiple system boundaries while producing one canonical, auditable reasoning result.

The system separates **evidence collection**, **reasoning**, **presentation**, and **action execution** so a translation, UI, or connectivity mode cannot silently mutate the underlying diagnosis.

## Layers

```text
Web / CLI / Chat / Low-bandwidth clients
                |
                v
        Incident API / Gateway
                |
                v
       Coordinator / Orchestrator
                |
       +--------+---------+----------+----------+
       |        |         |          |          |
       v        v         v          v          v
     Repo       CI       Logs     Database   Monitoring
     Agent     Agent     Agent      Agent       Agent
       \        |         |          |          /
        +--------+---------+----------+---------+
                         |
                         v
                 Evidence Registry
                         |
                         v
                Reasoning / Synthesis
                         |
                         v
              Canonical Reasoning Packet
                         |
          +--------------+---------------+
          |              |               |
          v              v               v
      Technical       Kiswahili      Plain / Low-
       English          view          bandwidth
                         |
                         v
                Human approval gate
                         |
                         v
                    Tool action
```

## Canonical Reasoning Packet

The CRP is the core DevRelay contract. It contains:

- incident identity and severity;
- normalized evidence with source and freshness;
- root-cause hypothesis;
- confidence and confidence ceiling;
- contradictions and missing evidence;
- recommended actions and risk;
- audit trail.

Presentation layers may simplify or translate the packet, but **must not alter**:

1. root-cause semantics;
2. evidence provenance;
3. confidence ceiling;
4. safety/approval requirements.

## Safety boundary

DevRelay is read-first.

Read-only investigations can execute automatically. Mutations—opening a PR, changing configuration, restarting services, or modifying infrastructure—must pass a policy gate. Medium/high-risk actions require explicit human approval.

## Hackathon MVP

The MVP proves the architecture with:

- GitHub repository / PR evidence;
- simulated runtime logs;
- simulated database health;
- multi-agent correlation;
- canonical reasoning packet;
- English + Kiswahili + plain-language rendering;
- stale/offline evidence handling;
- human approval before a proposed fix.

Additional providers are adapters, not rewrites of the core reasoning engine.
