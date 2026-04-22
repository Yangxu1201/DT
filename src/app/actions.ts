"use server";

import { revalidatePath } from "next/cache";
import { DecisionType, WorkStatus } from "@prisma/client";
import { z } from "zod";
import { analyzeManagerMessage } from "@/lib/analysis";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { defaultManagerProfile } from "@/lib/defaults";
import { prisma } from "@/lib/db";
import { enhanceDraftWithLlm } from "@/lib/llm";

const createWorkItemSchema = z.object({
  rawMessage: z.string().min(8, "Manager message should have enough detail to analyze."),
  conversationContext: z.string().optional(),
});

const updateManagerProfileSchema = z.object({
  profileId: z.string().optional(),
  name: z.string().min(2, "Manager name is required."),
  responseLatencyHours: z.coerce.number().int().min(1).max(72),
  infoDensity: z.enum(["high", "medium", "low"]),
  proactiveCadence: z.enum(["push-often", "daily", "milestone"]),
  prefersConclusionFirst: z.enum(["true", "false"]).transform((value) => value === "true"),
  riskTolerance: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

const updateWorkItemStatusSchema = z.object({
  workItemId: z.string(),
  workStatus: z.enum(["DRAFT", "IN_PROGRESS", "WAITING_ON_MANAGER", "BLOCKED", "COMPLETE"]),
});

const updateWorkItemSchema = z.object({
  workItemId: z.string(),
  thinking: z.string().min(3),
  plan: z.string().min(3),
  timeline: z.string().min(3),
  expectedOutput: z.string().min(3),
  riskOrBlocker: z.string().min(3),
  replyDraft: z.string().min(3),
});

const addFollowUpSchema = z.object({
  workItemId: z.string(),
  title: z.string().min(3, "Follow-up title is required."),
  dueAt: z.string().min(3, "Pick a due time."),
});

async function getOrCreateManagerProfile() {
  await ensureDatabaseReady();
  const existing = await prisma.managerProfile.findFirst();

  if (existing) {
    return existing;
  }

  return prisma.managerProfile.create({
    data: defaultManagerProfile,
  });
}

export async function createWorkItemAction(formData: FormData) {
  await ensureDatabaseReady();

  const parsed = createWorkItemSchema.safeParse({
    rawMessage: formData.get("rawMessage"),
    conversationContext: formData.get("conversationContext"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid work item input.");
  }

  const managerProfile = await getOrCreateManagerProfile();
  const draft = analyzeManagerMessage(parsed.data.rawMessage, {
    id: managerProfile.id,
    name: managerProfile.name,
    responseLatencyHours: managerProfile.responseLatencyHours,
    infoDensity: managerProfile.infoDensity as "high" | "medium" | "low",
    proactiveCadence: managerProfile.proactiveCadence as "push-often" | "daily" | "milestone",
    prefersConclusionFirst: managerProfile.prefersConclusionFirst,
    riskTolerance: managerProfile.riskTolerance as "low" | "medium" | "high",
    notes: managerProfile.notes,
  });
  const enhanced = await enhanceDraftWithLlm({
    rawMessage: parsed.data.rawMessage,
    manager: {
      id: managerProfile.id,
      name: managerProfile.name,
      responseLatencyHours: managerProfile.responseLatencyHours,
      infoDensity: managerProfile.infoDensity as "high" | "medium" | "low",
      proactiveCadence: managerProfile.proactiveCadence as "push-often" | "daily" | "milestone",
      prefersConclusionFirst: managerProfile.prefersConclusionFirst,
      riskTolerance: managerProfile.riskTolerance as "low" | "medium" | "high",
      notes: managerProfile.notes,
    },
    draft,
  });

  await prisma.workItem.create({
    data: {
      rawMessage: parsed.data.rawMessage,
      conversationContext: parsed.data.conversationContext,
      mainlineTask: enhanced.draft.mainlineTask,
      thinking: enhanced.draft.thinking,
      plan: enhanced.draft.plan,
      timeline: enhanced.draft.timeline,
      expectedOutput: enhanced.draft.expectedOutput,
      neededResources: enhanced.draft.neededResources,
      decisionType: enhanced.draft.decision.decisionType as DecisionType,
      decisionReasoning: enhanced.draft.decision.reasoning,
      decisionConfidence: enhanced.draft.decision.confidence,
      missingInputs: enhanced.draft.decision.missingInputs,
      recommendedEscalation: enhanced.draft.decision.recommendedEscalation,
      mainlinePriority: enhanced.draft.mainlinePriority,
      workStatus:
        enhanced.draft.decision.decisionType === "MANAGER_APPROVAL_REQUIRED"
          ? WorkStatus.WAITING_ON_MANAGER
          : WorkStatus.IN_PROGRESS,
      nextManagerUpdateAt: enhanced.draft.nextManagerUpdateAt,
      riskOrBlocker: enhanced.draft.riskOrBlocker,
      replyDraft: enhanced.draft.replyDraft,
      managerProfileId: managerProfile.id,
      followUps: {
        create: {
          title: enhanced.draft.followUpTitle,
          dueAt: enhanced.draft.nextManagerUpdateAt,
        },
      },
    },
  });

  revalidatePath("/");
}

export async function updateManagerProfileAction(formData: FormData) {
  await ensureDatabaseReady();

  const parsed = updateManagerProfileSchema.safeParse({
    profileId: formData.get("profileId"),
    name: formData.get("name"),
    responseLatencyHours: formData.get("responseLatencyHours"),
    infoDensity: formData.get("infoDensity"),
    proactiveCadence: formData.get("proactiveCadence"),
    prefersConclusionFirst: formData.get("prefersConclusionFirst"),
    riskTolerance: formData.get("riskTolerance"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid manager profile input.");
  }

  const { profileId, ...data } = parsed.data;

  if (profileId) {
    await prisma.managerProfile.update({
      where: { id: profileId },
      data,
    });
  } else {
    await prisma.managerProfile.create({ data });
  }

  revalidatePath("/");
}

export async function updateFollowUpStatusAction(formData: FormData) {
  await ensureDatabaseReady();

  const followUpId = z.string().parse(formData.get("followUpId"));
  const status = z.enum(["PENDING", "DONE", "MISSED"]).parse(formData.get("status"));

  await prisma.followUp.update({
    where: { id: followUpId },
    data: { status },
  });

  revalidatePath("/");
}

export async function updateWorkItemStatusAction(formData: FormData) {
  await ensureDatabaseReady();

  const parsed = updateWorkItemStatusSchema.safeParse({
    workItemId: formData.get("workItemId"),
    workStatus: formData.get("workStatus"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid work item status update.");
  }

  const nextManagerUpdateAt = new Date();

  if (parsed.data.workStatus === "WAITING_ON_MANAGER") {
    nextManagerUpdateAt.setHours(nextManagerUpdateAt.getHours() + 12);
  } else if (parsed.data.workStatus === "BLOCKED") {
    nextManagerUpdateAt.setHours(nextManagerUpdateAt.getHours() + 4);
  } else if (parsed.data.workStatus === "COMPLETE") {
    nextManagerUpdateAt.setHours(nextManagerUpdateAt.getHours() + 24);
  } else {
    nextManagerUpdateAt.setHours(nextManagerUpdateAt.getHours() + 6);
  }

  await prisma.workItem.update({
    where: { id: parsed.data.workItemId },
    data: {
      workStatus: parsed.data.workStatus as WorkStatus,
      nextManagerUpdateAt,
    },
  });

  revalidatePath("/");
}

export async function updateWorkItemAction(formData: FormData) {
  await ensureDatabaseReady();

  const parsed = updateWorkItemSchema.safeParse({
    workItemId: formData.get("workItemId"),
    thinking: formData.get("thinking"),
    plan: formData.get("plan"),
    timeline: formData.get("timeline"),
    expectedOutput: formData.get("expectedOutput"),
    riskOrBlocker: formData.get("riskOrBlocker"),
    replyDraft: formData.get("replyDraft"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid work item update.");
  }

  await prisma.workItem.update({
    where: { id: parsed.data.workItemId },
    data: {
      thinking: parsed.data.thinking,
      plan: parsed.data.plan,
      timeline: parsed.data.timeline,
      expectedOutput: parsed.data.expectedOutput,
      riskOrBlocker: parsed.data.riskOrBlocker,
      replyDraft: parsed.data.replyDraft,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/");
}

export async function addFollowUpAction(formData: FormData) {
  await ensureDatabaseReady();

  const parsed = addFollowUpSchema.safeParse({
    workItemId: formData.get("workItemId"),
    title: formData.get("title"),
    dueAt: formData.get("dueAt"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid follow-up input.");
  }

  await prisma.followUp.create({
    data: {
      workItemId: parsed.data.workItemId,
      title: parsed.data.title,
      dueAt: new Date(parsed.data.dueAt),
    },
  });

  revalidatePath("/");
}

export async function rerunWorkItemAnalysisAction(formData: FormData) {
  await ensureDatabaseReady();

  const workItemId = z.string().parse(formData.get("workItemId"));
  const workItem = await prisma.workItem.findUnique({
    where: { id: workItemId },
    include: { managerProfile: true },
  });

  if (!workItem) {
    throw new Error("Work item not found.");
  }

  const draft = analyzeManagerMessage(workItem.rawMessage, {
    id: workItem.managerProfile.id,
    name: workItem.managerProfile.name,
    responseLatencyHours: workItem.managerProfile.responseLatencyHours,
    infoDensity: workItem.managerProfile.infoDensity as "high" | "medium" | "low",
    proactiveCadence: workItem.managerProfile.proactiveCadence as
      | "push-often"
      | "daily"
      | "milestone",
    prefersConclusionFirst: workItem.managerProfile.prefersConclusionFirst,
    riskTolerance: workItem.managerProfile.riskTolerance as "low" | "medium" | "high",
    notes: workItem.managerProfile.notes,
  });
  const enhanced = await enhanceDraftWithLlm({
    rawMessage: workItem.rawMessage,
    manager: {
      id: workItem.managerProfile.id,
      name: workItem.managerProfile.name,
      responseLatencyHours: workItem.managerProfile.responseLatencyHours,
      infoDensity: workItem.managerProfile.infoDensity as "high" | "medium" | "low",
      proactiveCadence: workItem.managerProfile.proactiveCadence as "push-often" | "daily" | "milestone",
      prefersConclusionFirst: workItem.managerProfile.prefersConclusionFirst,
      riskTolerance: workItem.managerProfile.riskTolerance as "low" | "medium" | "high",
      notes: workItem.managerProfile.notes,
    },
    draft,
  });

  await prisma.workItem.update({
    where: { id: workItemId },
    data: {
      thinking: enhanced.draft.thinking,
      plan: enhanced.draft.plan,
      timeline: enhanced.draft.timeline,
      expectedOutput: enhanced.draft.expectedOutput,
      neededResources: enhanced.draft.neededResources,
      decisionType: enhanced.draft.decision.decisionType as DecisionType,
      decisionReasoning: enhanced.draft.decision.reasoning,
      decisionConfidence: enhanced.draft.decision.confidence,
      missingInputs: enhanced.draft.decision.missingInputs,
      recommendedEscalation: enhanced.draft.decision.recommendedEscalation,
      mainlinePriority: enhanced.draft.mainlinePriority,
      nextManagerUpdateAt: enhanced.draft.nextManagerUpdateAt,
      riskOrBlocker: enhanced.draft.riskOrBlocker,
      replyDraft: enhanced.draft.replyDraft,
      analysisVersion: { increment: 1 },
    },
  });

  revalidatePath("/");
}
