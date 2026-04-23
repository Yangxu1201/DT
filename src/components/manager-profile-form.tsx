"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateManagerProfileAction,
  type ManagerProfileFormState,
} from "@/app/actions";

type ManagerProfileFormProps = {
  profile: {
    id?: string;
    name: string;
    responseLatencyHours: number;
    infoDensity: "high" | "medium" | "low";
    proactiveCadence: "push-often" | "daily" | "milestone";
    prefersConclusionFirst: boolean;
    riskTolerance: "low" | "medium" | "high";
    notes?: string | null;
  };
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="secondary-button" disabled={pending}>
      {pending ? "Saving..." : "Save manager profile"}
    </button>
  );
}

const initialManagerProfileFormState: ManagerProfileFormState = {
  status: "idle",
  message: "",
};

export function ManagerProfileForm({ profile }: ManagerProfileFormProps) {
  const [state, formAction] = useActionState<ManagerProfileFormState, FormData>(
    updateManagerProfileAction,
    initialManagerProfileFormState,
  );

  return (
    <form action={formAction} className="stack compact">
      {profile.id ? <input type="hidden" name="profileId" value={profile.id} /> : null}

      <label className="field compact">
        <span>Manager name</span>
        <input type="text" name="name" defaultValue={profile.name} required />
      </label>

      <div className="inline-fields">
        <label className="field compact">
          <span>Response in</span>
          <input
            type="number"
            name="responseLatencyHours"
            min={1}
            max={72}
            defaultValue={profile.responseLatencyHours}
            required
          />
        </label>

        <label className="field compact">
          <span>Info density</span>
          <select name="infoDensity" defaultValue={profile.infoDensity}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
      </div>

      <div className="inline-fields">
        <label className="field compact">
          <span>Proactive cadence</span>
          <select name="proactiveCadence" defaultValue={profile.proactiveCadence}>
            <option value="push-often">push-often</option>
            <option value="daily">daily</option>
            <option value="milestone">milestone</option>
          </select>
        </label>

        <label className="field compact">
          <span>Risk tolerance</span>
          <select name="riskTolerance" defaultValue={profile.riskTolerance}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>

      <label className="field compact">
        <span>Conclusion first</span>
        <select
          name="prefersConclusionFirst"
          defaultValue={String(profile.prefersConclusionFirst)}
        >
          <option value="true">yes</option>
          <option value="false">no</option>
        </select>
      </label>

      <label className="field compact">
        <span>Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={profile.notes ?? "Wants frequent visible updates, low patience, and proactive communication."}
        />
      </label>

      <div className="form-action-row">
        <SaveButton />
        {state.status !== "idle" ? (
          <p className={`form-feedback ${state.status}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
