"use client";

import { useState } from "react";
import type { BorderlessRelayMode, BorderlessRelayView } from "@devrelay/core";

function serializeMessage(view: BorderlessRelayView): string {
  if (view.compactText) return view.compactText;

  const lines = [
    view.presentation,
    "",
    "---",
    `Confidence: ${Math.round(view.confidence * 100)}%`,
    `Confidence ceiling: ${Math.round(view.confidenceCeiling * 100)}%`,
    `Evidence references: ${view.evidenceIds.join(", ") || "None"}`,
    `Human approval: ${view.safetyGate === "human-approval-required" ? "Required" : "Not required"}`,
  ];

  if (view.contradictions.length > 0) {
    lines.push(
      "",
      "Contradictions:",
      ...view.contradictions.map((item) => `- ${item}`),
    );
  }

  if (view.missingEvidence.length > 0) {
    lines.push(
      "",
      "Still to verify:",
      ...view.missingEvidence.map((item) => `- ${item}`),
    );
  }

  if (view.actions.length > 0) {
    lines.push(
      "",
      "Recommended actions:",
      ...view.actions.map(
        (action) =>
          `- ${action.description} [risk=${action.risk}; approval=${action.approval}]`,
      ),
    );
  }

  lines.push("", `Packet: ${view.packetInvariantId}`);

  return lines.join("\n");
}

export function RelayMessage({
  views,
  incidentId,
}: {
  views: BorderlessRelayView[];
  incidentId: string;
}) {
  const [mode, setMode] = useState<BorderlessRelayMode>("technical-en");
  const [copyStatus, setCopyStatus] = useState("");

  const view = views.find((item) => item.mode === mode) ?? views[0];
  const message = view ? serializeMessage(view) : "";

  if (!view) return null;

  const viewTitle = view.title;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(`${viewTitle} message copied.`);
    } catch {
      setCopyStatus(
        "Copy is unavailable in this browser. Use Download text instead.",
      );
    }
  }

  function downloadMessage() {
    const url = URL.createObjectURL(
      new Blob([message], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `devrelay-${incidentId}-${mode}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCopyStatus(`${viewTitle} message downloaded.`);
  }

  return (
    <>
      <fieldset className="relayModes">
        <legend>Message format</legend>
        {views.map((item) => (
          <label key={item.mode}>
            <input
              type="radio"
              name={`relay-mode-${incidentId}`}
              value={item.mode}
              checked={mode === item.mode}
              onChange={() => {
                setMode(item.mode);
                setCopyStatus("");
              }}
            />
            <span>{item.title}</span>
          </label>
        ))}
      </fieldset>

      <div className="relayGrid">
        <article
          className={`relayCard ${mode === "low-bandwidth" ? "lowBandwidth" : ""}`}
          aria-labelledby="relay-preview-title"
        >
          <div className="relayHeader">
            <div>
              <h3 id="relay-preview-title">{view.title}</h3>
              <small lang={view.locale}>{view.subtitle}</small>
            </div>
            <span className="relayFormatBadge">{mode}</span>
          </div>

          {view.compactText ? (
            <pre>{view.compactText}</pre>
          ) : (
            <p lang={view.locale}>{view.presentation}</p>
          )}

          {mode === "kiswahili" && (
            <p className="smallText">
              Kiswahili framing is localized; the canonical diagnosis remains
              unchanged so the verified reasoning state cannot drift.
            </p>
          )}

          <details className="relayExportPreview">
            <summary>Preview copied/downloaded message</summary>
            <pre>{message}</pre>
          </details>
        </article>

        <aside className="relayContext" aria-label="Preserved reasoning and safety">
          <h3>Preserved in every format</h3>

          <div className="relayInvariantGrid">
            <div>
              <span>Confidence</span>
              <strong>{Math.round(view.confidence * 100)}%</strong>
            </div>
            <div>
              <span>Confidence ceiling</span>
              <strong>{Math.round(view.confidenceCeiling * 100)}%</strong>
            </div>
            <div>
              <span>Evidence references</span>
              <strong>{view.evidenceIds.length}</strong>
            </div>
            <div>
              <span>Human approval</span>
              <strong>
                {view.safetyGate === "human-approval-required"
                  ? "Required"
                  : "Not required"}
              </strong>
            </div>
          </div>

          <div className="evidenceLinks" aria-label="Supporting evidence references">
            {view.evidenceIds.map((id) => (
              <a key={id} href={`#evidence-${id}`}>
                {id}
              </a>
            ))}
          </div>

          {view.contradictions.length > 0 && (
            <div className="relayCaveat">
              <strong>Contradictions</strong>
              <ul>
                {view.contradictions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {view.missingEvidence.length > 0 && (
            <div className="relayCaveat">
              <strong>Still to verify</strong>
              <ul>
                {view.missingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <a className="inlineLink" href="#response">
            Review recommended response ↑
          </a>

          <p className="smallText">
            Packet version <code>{view.packetInvariantId}</code>
          </p>
        </aside>
      </div>

      <div className="relayActions">
        <button type="button" onClick={copyMessage}>
          Copy {view.title}
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={downloadMessage}
        >
          Download {view.title}
        </button>
        <span className="smallText">
          Export includes this format plus the preserved evidence and safety metadata.
        </span>
      </div>

      <p
        className="smallText copyStatus"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {copyStatus}
      </p>
    </>
  );
}
