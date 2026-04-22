import type { ManagerProfileInput } from "./analysis";

export const defaultManagerProfile: Omit<ManagerProfileInput, "id"> = {
  name: "Rule-setting remote manager",
  responseLatencyHours: 6,
  infoDensity: "high",
  proactiveCadence: "push-often",
  prefersConclusionFirst: true,
  riskTolerance: "low",
  notes:
    "Wants frequent visible updates, low patience, expects proactive communication, and is sensitive to silence.",
};
