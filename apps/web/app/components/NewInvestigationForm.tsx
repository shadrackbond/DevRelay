import { createInvestigation } from "../actions/investigations";
import { SubmitInvestigationButton } from "./SubmitInvestigationButton";

export function NewInvestigationForm() {
  return (
    <form action={createInvestigation} className="investigationForm">
      <p className="formIntro">All fields are required.</p>
      <div className="formGrid">
        <label>
          <span>Incident title</span>
          <input
            name="title"
            autoComplete="off"
            required
            maxLength={120}
            placeholder="e.g. Checkout requests timing out…"
          />
        </label>

        <label>
          <span>Affected service</span>
          <input
            name="service"
            autoComplete="off"
            spellCheck={false}
            required
            maxLength={80}
            placeholder="e.g. checkout-service…"
          />
        </label>
      </div>

      <label>
        <span>GitHub repository</span>
        <input
          name="repository"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="repository-hint"
          required
          maxLength={200}
          placeholder="e.g. owner/repository…"
        />
        <small className="fieldHint" id="repository-hint">
          Enter a GitHub URL or owner/repository. Public repositories work immediately; private access must be configured by your administrator.
        </small>
      </label>

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
          autoComplete="off"
          required
          maxLength={1200}
          rows={7}
          placeholder="Describe symptoms, when they started, affected users, and recent changes…"
        />
      </label>

      <div className="formNotice">
        <strong>Context first. Evidence next.</strong>
        <p>
          DevRelay creates the incident immediately, then waits for connected
          evidence providers before making a root-cause claim.
        </p>
      </div>

      <SubmitInvestigationButton />
    </form>
  );
}
