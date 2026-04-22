import { describe, expect, it } from "vitest";
import { buildReportSummaries } from "./reports";

const now = new Date("2026-04-22T10:00:00.000Z");

describe("buildReportSummaries", () => {
  it("aggregates the same work items differently across time windows", () => {
    const summaries = buildReportSummaries(
      [
        {
          id: "a",
          mainlineTask: "Send project risk summary",
          workStatus: "IN_PROGRESS",
          mainlinePriority: "P0",
          riskOrBlocker: "Waiting on one supplier response.",
          createdAt: new Date("2026-04-22T08:00:00.000Z"),
          updatedAt: new Date("2026-04-22T08:00:00.000Z"),
          followUps: [
            {
              status: "PENDING",
              dueAt: new Date("2026-04-22T09:00:00.000Z"),
            },
          ],
        },
        {
          id: "b",
          mainlineTask: "Prepare weekly AI learning summary",
          workStatus: "COMPLETE",
          mainlinePriority: "P2",
          riskOrBlocker: "No immediate blocker identified.",
          createdAt: new Date("2026-04-18T08:00:00.000Z"),
          updatedAt: new Date("2026-04-18T10:00:00.000Z"),
          followUps: [],
        },
      ],
      now,
    );

    expect(summaries.daily.totalItems).toBe(1);
    expect(summaries.daily.overdueFollowUps).toBe(1);
    expect(summaries.weekly.totalItems).toBe(2);
    expect(summaries.monthly.completedItems).toBe(1);
  });
});
