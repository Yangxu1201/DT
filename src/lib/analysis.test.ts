import { describe, expect, it } from "vitest";
import { analyzeManagerMessage } from "./analysis";

const manager = {
  id: "mgr_1",
  name: "Remote manager",
  responseLatencyHours: 6,
  infoDensity: "high" as const,
  proactiveCadence: "push-often" as const,
  prefersConclusionFirst: true,
  riskTolerance: "low" as const,
  notes: "Wants visible updates.",
};

describe("analyzeManagerMessage", () => {
  it("marks supplier-choice requests as manager approval required", () => {
    const result = analyzeManagerMessage(
      "Please choose the supplier tonight and tell me if we should switch vendors.",
      manager,
    );

    expect(result.decision.decisionType).toBe("MANAGER_APPROVAL_REQUIRED");
    expect(result.decision.reasoning.length).toBeGreaterThan(20);
    expect(result.decision.confidence).toBeGreaterThanOrEqual(80);
    expect(result.decision.missingInputs).toEqual([]);
    expect(result.decision.recommendedEscalation).toContain("manager");
  });

  it("treats AI research work as directly ownable product scope", () => {
    const result = analyzeManagerMessage(
      "Please research the AI feature ROI and send me the first recommendation tomorrow.",
      manager,
    );

    expect(result.decision.decisionType).toBe("CAN_DECIDE");
    expect(result.mainlinePriority).toBe("P1");
    expect(result.neededResources).toContain("Relevant AI research notes");
  });

  it("asks for clarification when the request is too vague", () => {
    const result = analyzeManagerMessage("Handle this for me.", manager);

    expect(result.decision.decisionType).toBe("INSUFFICIENT_INFO");
    expect(result.decision.missingInputs.length).toBeGreaterThan(0);
    expect(result.replyDraft).toContain("主线");
  });

  it("changes reply style and follow-up timing based on manager profile", () => {
    const slowManager = {
      ...manager,
      responseLatencyHours: 24,
      infoDensity: "low" as const,
      proactiveCadence: "milestone" as const,
      prefersConclusionFirst: false,
      riskTolerance: "high" as const,
    };

    const intenseManager = {
      ...manager,
      responseLatencyHours: 12,
      infoDensity: "high" as const,
      proactiveCadence: "push-often" as const,
      prefersConclusionFirst: true,
      riskTolerance: "low" as const,
    };

    const rawMessage = "Please choose the supplier tonight and send me the project risk summary.";
    const slowResult = analyzeManagerMessage(rawMessage, slowManager);
    const intenseResult = analyzeManagerMessage(rawMessage, intenseManager);

    expect(slowResult.replyDraft).toContain("我先同步一下我对这件事的理解");
    expect(intenseResult.replyDraft).toContain("结论先说");
    expect(intenseResult.replyDraft).toContain("主动多给你几次过程更新");
    expect(intenseResult.nextManagerUpdateAt.getTime()).toBeLessThan(
      slowResult.nextManagerUpdateAt.getTime(),
    );
  });
});
