"use client";

import { useFormStatus } from "react-dom";

export function SubmitInvestigationButton({ label = "Create investigation", pendingLabel = "Creating investigation…" }: { label?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="formSubmit" aria-live="polite">
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}
