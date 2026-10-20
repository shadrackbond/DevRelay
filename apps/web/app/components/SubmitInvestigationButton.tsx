"use client";

import { useFormStatus } from "react-dom";

export function SubmitInvestigationButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Creating investigation…" : "Create investigation →"}
    </button>
  );
}
