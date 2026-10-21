"use client";

import { useState } from "react";
import type { BorderlessRelayMode, BorderlessRelayView } from "@devrelay/core";

export function RelayMessage({ views, incidentId }: { views: BorderlessRelayView[]; incidentId: string }) {
  const [mode, setMode] = useState<BorderlessRelayMode>("technical-en");
  const [copyStatus, setCopyStatus] = useState("");
  const view = views.find((item) => item.mode === mode);
  if (!view) return null;
  const compactText = views.find((item) => item.mode === "low-bandwidth")?.compactText ?? "";
  const message = view.compactText ?? `${view.presentation}\n\n${compactText}`;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus(`${view?.title} message copied, including evidence and safety requirements.`);
    } catch {
      setCopyStatus("Copy is unavailable in this browser. Download the text instead.");
    }
  }

  function downloadMessage() {
    const url = URL.createObjectURL(new Blob([message], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `devrelay-${incidentId}-${mode}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <fieldset className="relayModes">
        <legend>Message format</legend>
        {views.map((item) => (
          <label key={item.mode}>
            <input type="radio" name={`relay-mode-${incidentId}`} value={item.mode} checked={mode === item.mode}
              onChange={() => { setMode(item.mode); setCopyStatus(""); }} />
            <span>{item.title}</span>
          </label>
        ))}
      </fieldset>

      <div className="relayGrid">
        <article className={`relayCard ${mode === "low-bandwidth" ? "lowBandwidth" : ""}`} aria-labelledby="relay-preview-title">
          <div className="relayHeader">
            <div>
              <h3 id="relay-preview-title">{view.title}</h3>
              <small lang={view.locale}>{view.subtitle}</small>
            </div>
          </div>
          {view.compactText ? <pre>{view.compactText}</pre> : <p lang={view.locale}>{view.presentation}</p>}
          {mode === "kiswahili" && <p className="smallText">Kiswahili framing; the canonical diagnosis and evidence remain in English.</p>}
        </article>

        <aside className="relayContext" aria-label="Preserved reasoning and safety">
          <h3>Preserved in every format</h3>
          <div className="relayInvariantGrid">
            <div><span>Confidence</span><strong>{Math.round(view.confidence * 100)}%</strong></div>
            <div><span>Confidence ceiling</span><strong>{Math.round(view.confidenceCeiling * 100)}%</strong></div>
            <div><span>Evidence references</span><strong>{view.evidenceIds.length}</strong></div>
            <div><span>Human approval</span><strong>{view.safetyGate === "human-approval-required" ? "Required" : "Not required"}</strong></div>
          </div>
          <div className="evidenceLinks" aria-label="Supporting evidence references">
            {view.evidenceIds.map((id) => <a key={id} href={`#evidence-${id}`}>{id}</a>)}
          </div>
          {view.contradictions.length > 0 && <div className="relayCaveat"><strong>Contradictions</strong><ul>{view.contradictions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {view.missingEvidence.length > 0 && <div className="relayCaveat"><strong>Still to verify</strong><ul>{view.missingEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          <a className="inlineLink" href="#response">Review recommended response ↑</a>
          <p className="smallText">Packet version <code>{view.packetInvariantId}</code></p>
        </aside>
      </div>

      <div className="relayActions">
        <button type="button" onClick={copyMessage}>Copy message</button>
        <button type="button" className="secondaryButton" onClick={downloadMessage}>Download text</button>
        <span className="smallText">Both include all actions, evidence references, and known gaps.</span>
      </div>
      <p className="smallText copyStatus" role="status">{copyStatus}</p>
    </>
  );
}
