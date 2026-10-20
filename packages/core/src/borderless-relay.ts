import type {
  ApprovalState,
  CanonicalReasoningPacket,
  RecommendedAction,
} from "./types";

export type BorderlessRelayMode =
  | "technical-en"
  | "kiswahili"
  | "plain-en"
  | "low-bandwidth";

export type RelaySafetyGate =
  | "human-approval-required"
  | "no-human-approval-required";

export interface BorderlessRelayAction {
  id: string;
  description: string;
  risk: RecommendedAction["risk"];
  approval: ApprovalState;
}

export interface BorderlessRelayView {
  mode: BorderlessRelayMode;
  locale: "en" | "sw";
  title: string;
  subtitle: string;
  canonicalDiagnosis: string;
  presentation: string;
  confidence: number;
  confidenceCeiling: number;
  evidenceIds: string[];
  contradictions: string[];
  missingEvidence: string[];
  actions: BorderlessRelayAction[];
  safetyGate: RelaySafetyGate;
  packetInvariantId: string;
  compactText?: string;
}

export interface RelayInvariantResult {
  valid: boolean;
  errors: string[];
}

function safetyGate(packet: CanonicalReasoningPacket): RelaySafetyGate {
  return packet.actions.some((action) => action.approval === "required")
    ? "human-approval-required"
    : "no-human-approval-required";
}

function stableInvariantPayload(packet: CanonicalReasoningPacket): string {
  return JSON.stringify({
    incidentId: packet.incident.id,
    diagnosis: packet.hypothesis.statement,
    confidence: packet.hypothesis.confidence,
    confidenceCeiling: packet.confidenceCeiling,
    evidenceIds: [...packet.hypothesis.evidenceIds].sort(),
    contradictions: [...packet.hypothesis.contradictions],
    missingEvidence: [...packet.hypothesis.missingEvidence],
    actions: packet.actions.map((action) => ({
      id: action.id,
      risk: action.risk,
      approval: action.approval,
    })),
    safetyGate: safetyGate(packet),
  });
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function relayInvariantId(packet: CanonicalReasoningPacket): string {
  return `crp-${packet.incident.id}-${fnv1a(stableInvariantPayload(packet))}`;
}

function percent(value: number): number {
  return Math.round(value * 100);
}

function actionSummary(packet: CanonicalReasoningPacket): string {
  const required = packet.actions.filter(
    (action) => action.approval === "required",
  ).length;

  if (required > 0) {
    return `${required} recommended action(s) require human approval.`;
  }

  if (packet.actions.length > 0) {
    return `${packet.actions.length} recommended action(s) are available.`;
  }

  return "No remediation action is currently recommended.";
}

function renderTechnical(packet: CanonicalReasoningPacket): Pick<
  BorderlessRelayView,
  "title" | "subtitle" | "presentation"
> {
  return {
    title: "Technical English",
    subtitle: "Full engineering context",
    presentation:
      `DevRelay's current leading diagnosis is: ${packet.hypothesis.statement} ` +
      `Confidence is ${percent(packet.hypothesis.confidence)}% with a ${percent(packet.confidenceCeiling)}% ceiling. ` +
      `${packet.hypothesis.evidenceIds.length} evidence reference(s) support the hypothesis. ` +
      actionSummary(packet),
  };
}

function renderKiswahili(packet: CanonicalReasoningPacket): Pick<
  BorderlessRelayView,
  "title" | "subtitle" | "presentation"
> {
  const missing = packet.hypothesis.missingEvidence.length;
  const approvalRequired = packet.actions.some(
    (action) => action.approval === "required",
  );

  return {
    title: "Kiswahili",
    subtitle: "Maelezo yaliyorahisishwa bila kubadili uamuzi",
    presentation:
      `Hitimisho kuu la DevRelay ni: ${packet.hypothesis.statement} ` +
      `Kiwango cha uhakika ni ${percent(packet.hypothesis.confidence)}%, na kikomo cha juu ni ${percent(packet.confidenceCeiling)}%. ` +
      `Uamuzi huu una marejeleo ${packet.hypothesis.evidenceIds.length} ya ushahidi. ` +
      (missing > 0
        ? `Bado kuna mapengo ${missing} ya ushahidi. `
        : "Hakuna pengo muhimu la ushahidi lililoripotiwa. ") +
      (approvalRequired
        ? "Hatua yenye athari kubwa inahitaji idhini ya binadamu."
        : "Hakuna hatua inayohitaji idhini ya binadamu kwa sasa."),
  };
}

function renderPlain(packet: CanonicalReasoningPacket): Pick<
  BorderlessRelayView,
  "title" | "subtitle" | "presentation"
> {
  const confidence = percent(packet.hypothesis.confidence);
  const missing = packet.hypothesis.missingEvidence.length;
  const approvalRequired = packet.actions.some(
    (action) => action.approval === "required",
  );

  return {
    title: "Plain language",
    subtitle: "For non-specialist incident stakeholders",
    presentation:
      `DevRelay's best current explanation is: ${packet.hypothesis.statement} ` +
      `It is ${confidence}% confident. ` +
      (missing > 0
        ? `Some information is still missing (${missing} gap(s)), so this result should not be treated as certain. `
        : "The main evidence sources currently agree. ") +
      (approvalRequired
        ? "Any risky production change must still be approved by a person."
        : "No risky production change is currently waiting for approval."),
  };
}

function renderLowBandwidth(packet: CanonicalReasoningPacket): Pick<
  BorderlessRelayView,
  "title" | "subtitle" | "presentation" | "compactText"
> {
  const gate = safetyGate(packet);
  const firstAction = packet.actions[0];

  const compactText = [
    `INCIDENT: ${packet.incident.id}`,
    `CAUSE: ${packet.hypothesis.statement}`,
    `CONF: ${percent(packet.hypothesis.confidence)}%`,
    `CEILING: ${percent(packet.confidenceCeiling)}%`,
    `EVIDENCE: ${packet.hypothesis.evidenceIds.length}`,
    `MISSING: ${packet.hypothesis.missingEvidence.length}`,
    `CONTRADICTIONS: ${packet.hypothesis.contradictions.length}`,
    `APPROVAL: ${gate === "human-approval-required" ? "REQUIRED" : "NOT REQUIRED"}`,
    firstAction ? `ACTION: ${firstAction.description}` : "ACTION: NONE",
  ].join("\n");

  return {
    title: "Low-bandwidth",
    subtitle: "Compact transport-safe text",
    presentation:
      "Compact representation generated from the same Canonical Reasoning Packet.",
    compactText,
  };
}

export function verifyBorderlessRelayInvariant(
  packet: CanonicalReasoningPacket,
  view: BorderlessRelayView,
): RelayInvariantResult {
  const errors: string[] = [];

  if (view.canonicalDiagnosis !== packet.hypothesis.statement) {
    errors.push("Canonical diagnosis changed.");
  }

  if (view.confidence !== packet.hypothesis.confidence) {
    errors.push("Confidence changed.");
  }

  if (view.confidenceCeiling !== packet.confidenceCeiling) {
    errors.push("Confidence ceiling changed.");
  }

  const expectedEvidence = [...packet.hypothesis.evidenceIds].sort();
  const actualEvidence = [...view.evidenceIds].sort();
  if (JSON.stringify(actualEvidence) !== JSON.stringify(expectedEvidence)) {
    errors.push("Evidence references changed.");
  }

  if (
    JSON.stringify(view.missingEvidence) !==
    JSON.stringify(packet.hypothesis.missingEvidence)
  ) {
    errors.push("Missing-evidence flags changed.");
  }

  if (
    JSON.stringify(view.contradictions) !==
    JSON.stringify(packet.hypothesis.contradictions)
  ) {
    errors.push("Contradictions changed.");
  }

  const expectedActions = packet.actions.map((action) => ({
    id: action.id,
    description: action.description,
    risk: action.risk,
    approval: action.approval,
  }));

  if (JSON.stringify(view.actions) !== JSON.stringify(expectedActions)) {
    errors.push("Action or approval semantics changed.");
  }

  if (view.safetyGate !== safetyGate(packet)) {
    errors.push("Safety gate changed.");
  }

  if (view.packetInvariantId !== relayInvariantId(packet)) {
    errors.push("Invariant fingerprint changed.");
  }

  return { valid: errors.length === 0, errors };
}

export function renderBorderlessRelay(
  packet: CanonicalReasoningPacket,
  mode: BorderlessRelayMode,
): BorderlessRelayView {
  const localized =
    mode === "technical-en"
      ? renderTechnical(packet)
      : mode === "kiswahili"
        ? renderKiswahili(packet)
        : mode === "plain-en"
          ? renderPlain(packet)
          : renderLowBandwidth(packet);

  const view: BorderlessRelayView = {
    mode,
    locale: mode === "kiswahili" ? "sw" : "en",
    ...localized,
    canonicalDiagnosis: packet.hypothesis.statement,
    confidence: packet.hypothesis.confidence,
    confidenceCeiling: packet.confidenceCeiling,
    evidenceIds: [...packet.hypothesis.evidenceIds],
    contradictions: [...packet.hypothesis.contradictions],
    missingEvidence: [...packet.hypothesis.missingEvidence],
    actions: packet.actions.map((action) => ({
      id: action.id,
      description: action.description,
      risk: action.risk,
      approval: action.approval,
    })),
    safetyGate: safetyGate(packet),
    packetInvariantId: relayInvariantId(packet),
  };

  const verification = verifyBorderlessRelayInvariant(packet, view);
  if (!verification.valid) {
    throw new Error(
      `Borderless Relay invariant violation: ${verification.errors.join(" ")}`,
    );
  }

  return view;
}

export function renderAllBorderlessRelayViews(
  packet: CanonicalReasoningPacket,
): BorderlessRelayView[] {
  return [
    renderBorderlessRelay(packet, "technical-en"),
    renderBorderlessRelay(packet, "kiswahili"),
    renderBorderlessRelay(packet, "plain-en"),
    renderBorderlessRelay(packet, "low-bandwidth"),
  ];
}
