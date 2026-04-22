import type { FollowUpStatus, WorkStatus } from "@prisma/client";

export type ReportWorkItem = {
  id: string;
  mainlineTask: string;
  workStatus: WorkStatus;
  mainlinePriority: string;
  riskOrBlocker: string;
  createdAt: Date;
  updatedAt: Date;
  followUps: {
    status: FollowUpStatus;
    dueAt: Date;
  }[];
};

export type ReportSummary = {
  title: string;
  totalItems: number;
  completedItems: number;
  waitingItems: number;
  blockedItems: number;
  overdueFollowUps: number;
  keyLines: string[];
  prose: string;
};

function isWithinWindow(date: Date, from: Date, to: Date) {
  return date >= from && date <= to;
}

function makeSummary(title: string, items: ReportWorkItem[], from: Date, to: Date): ReportSummary {
  const visible = items.filter((item) => isWithinWindow(item.createdAt, from, to));
  const completedItems = visible.filter((item) => item.workStatus === "COMPLETE").length;
  const waitingItems = visible.filter((item) => item.workStatus === "WAITING_ON_MANAGER").length;
  const blockedItems = visible.filter((item) => item.workStatus === "BLOCKED").length;
  const overdueFollowUps = visible.flatMap((item) => item.followUps).filter((followUp) => {
    return followUp.status === "PENDING" && followUp.dueAt < to;
  }).length;

  return {
    title,
    totalItems: visible.length,
    completedItems,
    waitingItems,
    blockedItems,
    overdueFollowUps,
    keyLines: visible.slice(0, 3).map((item) => {
      return `${item.mainlineTask} · ${item.workStatus} · ${item.mainlinePriority}`;
    }),
    prose: buildProseSummary(title, visible, {
      completedItems,
      waitingItems,
      blockedItems,
      overdueFollowUps,
    }),
  };
}

function buildProseSummary(
  title: string,
  items: ReportWorkItem[],
  metrics: {
    completedItems: number;
    waitingItems: number;
    blockedItems: number;
    overdueFollowUps: number;
  },
) {
  if (items.length === 0) {
    return `${title}: no tracked work items in this window yet.`;
  }

  const headline = `${title}: ${items.length} tracked items, ${metrics.completedItems} complete, ${metrics.waitingItems} waiting on manager, ${metrics.blockedItems} blocked, ${metrics.overdueFollowUps} overdue follow-ups.`;
  const highlights = items
    .slice(0, 3)
    .map((item) => {
      return `- ${item.mainlineTask} (${item.workStatus}, ${item.mainlinePriority})`;
    })
    .join("\n");

  return `${headline}\n${highlights}`;
}

export function buildReportSummaries(items: ReportWorkItem[], now = new Date()) {
  const end = now;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return {
    daily: makeSummary("Daily report", items, startOfDay, end),
    weekly: makeSummary("Weekly report", items, startOfWeek, end),
    monthly: makeSummary("Monthly report", items, startOfMonth, end),
  };
}
