import { createInvestigation } from "../actions/investigations";
import { SubmitInvestigationButton } from "./SubmitInvestigationButton";

export function NewInvestigationForm() {
  return (
    <form action={createInvestigation} className="investigationForm">
      <div className="formGrid">
        <label>
          <span>Incident title</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="e.g. Checkout requests timing out"
          />
        </label>

        <label>
          <span>Affected service</span>
          <input
            name="service"
            required
            maxLength={80}
            placeholder="e.g. checkout-service"
          />
        </label>
      </div>

      <label>
        <span>Severity</span>
        <select name="severity" defaultValue="high">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>

      <label>
        <span>What are you observing?</span>
        <textarea
          name="description"
          required
          maxLength={1200}
          rows={7}
          placeholder="Describe the symptoms, when they started, affected users, recent changes you know about, and anything already ruled out."
        />
      </label>

      <div className="formNotice">
        <strong>No evidence will be invented.</strong>
        <p>
          DevRelay creates the incident immediately, then waits for connected
          evidence providers before making a root-cause claim.
        </p>
      </div>

      <SubmitInvestigationButton />
    </form>
  );
}
