"use client";

import { useFormStatus } from "react-dom";

export function SubmitInvestigationButton() {
  const { pending } = useFormStatus();

  return (
    <div className="formSubmit" aria-live="polite">
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Creating investigation…" : "Create investigation"}
      </button>
    </div>
  );
}
