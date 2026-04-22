export type ManagerProfileInput = {
  id: string;
  name: string;
  responseLatencyHours: number;
  infoDensity: "high" | "medium" | "low";
  proactiveCadence: "push-often" | "daily" | "milestone";
  prefersConclusionFirst: boolean;
  riskTolerance: "low" | "medium" | "high";
  notes?: string | null;
};

export type DecisionAnalysis = {
  decisionType:
    | "CAN_DECIDE"
    | "RECOMMEND_ONLY"
    | "MANAGER_APPROVAL_REQUIRED"
    | "INSUFFICIENT_INFO";
  reasoning: string;
  confidence: number;
  missingInputs: string[];
  recommendedEscalation: string;
};

export type WorkItemDraft = {
  mainlineTask: string;
  thinking: string;
  plan: string;
  timeline: string;
  expectedOutput: string;
  neededResources: string[];
  decision: DecisionAnalysis;
  mainlinePriority: "P0" | "P1" | "P2";
  riskOrBlocker: string;
  replyDraft: string;
  nextManagerUpdateAt: Date;
  followUpTitle: string;
};

const PRODUCT_DOMAIN_WORDS = [
  "feature",
  "roi",
  "cost",
  "analysis",
  "spec",
  "requirement",
  "ai",
  "research",
  "roadmap",
];

const CROSS_FUNCTION_WORDS = [
  "supplier",
  "vendor",
  "certification",
  "brand",
  "amazon",
  "reddit",
  "marketing",
  "procurement",
  "choose",
  "selection",
];

const APPROVAL_WORDS = ["approve", "decide", "sign off", "pick", "final", "choose"];
const RISK_WORDS = ["risk", "blocked", "delay", "issue", "problem", "urgent"];
const UNKNOWN_WORDS = ["this", "that", "看看", "follow up", "handle it"];

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function inferMainlineTask(rawMessage: string) {
  const normalized = compactText(rawMessage);
  const sentence = normalized.split(/[.?!\n]/)[0] ?? normalized;
  return sentence.length > 96 ? `${sentence.slice(0, 93)}...` : sentence;
}

function inferDecision(rawMessage: string): DecisionAnalysis {
  const text = rawMessage.toLowerCase();

  if (text.length < 12 || containsAny(text, UNKNOWN_WORDS)) {
    return {
      decisionType: "INSUFFICIENT_INFO",
      reasoning: "The request is too vague to assign a safe owner or plan.",
      confidence: 35,
      missingInputs: [
        "Concrete deliverable",
        "Deadline or urgency",
        "Who should approve the final outcome",
      ],
      recommendedEscalation:
        "Reply with a clarification request before committing to a plan.",
    };
  }

  if (containsAny(text, CROSS_FUNCTION_WORDS) && containsAny(text, APPROVAL_WORDS)) {
    return {
      decisionType: "MANAGER_APPROVAL_REQUIRED",
      reasoning:
        "The request crosses into a function where the subordinate should frame options, not make the final call.",
      confidence: 88,
      missingInputs: [],
      recommendedEscalation:
        "Send options with pros and cons, then ask the manager to choose or confirm direction.",
    };
  }

  if (containsAny(text, CROSS_FUNCTION_WORDS)) {
    return {
      decisionType: "RECOMMEND_ONLY",
      reasoning:
        "The request spans a non-core function. The subordinate can gather data and recommend a direction, but should not silently own the decision.",
      confidence: 80,
      missingInputs: [],
      recommendedEscalation:
        "Prepare a recommendation package and explicitly mark the decision boundary.",
    };
  }

  if (containsAny(text, PRODUCT_DOMAIN_WORDS)) {
    return {
      decisionType: "CAN_DECIDE",
      reasoning:
        "This request fits the subordinate's product and analysis scope, so a recommendation and first action can be owned directly.",
      confidence: 76,
      missingInputs: [],
      recommendedEscalation:
        "Push forward with an initial answer, then surface tradeoffs in the next update.",
    };
  }

  return {
    decisionType: "RECOMMEND_ONLY",
    reasoning:
      "The request is actionable, but the safest default is to move it forward with a recommendation instead of assuming final decision authority.",
    confidence: 62,
    missingInputs: [],
    recommendedEscalation:
      "Acknowledge the task, share the first recommendation, and confirm any decision boundary.",
  };
}

function inferPriority(rawMessage: string): "P0" | "P1" | "P2" {
  const text = rawMessage.toLowerCase();
  if (containsAny(text, ["urgent", "asap", "tonight"]) || containsAny(text, RISK_WORDS)) {
    return "P0";
  }

  if (containsAny(text, ["today", "tomorrow", "this week"])) {
    return "P1";
  }

  return "P2";
}

function buildTimeline(priority: "P0" | "P1" | "P2") {
  if (priority === "P0") {
    return "Acknowledge now, gather inputs within 2 hours, send a substantive update by end of day.";
  }

  if (priority === "P1") {
    return "Acknowledge now, shape the work today, send the next manager-facing update within 24 hours.";
  }

  return "Acknowledge now, define the mainline next step today, and schedule the next update within 48 hours.";
}

function computeNextUpdateHours(
  manager: ManagerProfileInput,
  priority: "P0" | "P1" | "P2",
  decision: DecisionAnalysis,
) {
  let hours = manager.responseLatencyHours;

  if (manager.proactiveCadence === "push-often") {
    hours = Math.min(hours, priority === "P0" ? 2 : priority === "P1" ? 6 : 12);
  } else if (manager.proactiveCadence === "daily") {
    hours = Math.min(hours, priority === "P0" ? 4 : 24);
  } else {
    hours = Math.min(hours, priority === "P0" ? 6 : priority === "P1" ? 24 : 48);
  }

  if (manager.riskTolerance === "low" && decision.decisionType !== "CAN_DECIDE") {
    hours = Math.min(hours, 4);
  }

  return Math.max(1, hours);
}

function buildNeededResources(rawMessage: string, decision: DecisionAnalysis) {
  const resources = ["Prior chat context", "Current task load snapshot"];

  if (decision.decisionType !== "CAN_DECIDE") {
    resources.push("Manager confirmation on final decision owner");
  }

  if (rawMessage.toLowerCase().includes("ai")) {
    resources.push("Relevant AI research notes");
  }

  if (containsAny(rawMessage.toLowerCase(), CROSS_FUNCTION_WORDS)) {
    resources.push("Options from the relevant functional owner");
  }

  return resources;
}

function buildReplyDraft(
  manager: ManagerProfileInput,
  task: string,
  timeline: string,
  decision: DecisionAnalysis,
  riskOrBlocker: string,
) {
  const opener = manager.prefersConclusionFirst
    ? `结论先说：这件事我已经接住，主线是“${task}”。`
    : `我先同步一下我对这件事的理解：主线是“${task}”，我下面把计划和边界说清楚。`;

  const densityLine =
    manager.infoDensity === "high"
      ? `我会先按这个路径推进：${timeline}`
      : manager.infoDensity === "medium"
        ? "我先推进第一步，并在下一个时间点同步结论、风险和是否需要你拍板。"
        : "我先推进第一步，先给你一个短更新，细节我放到下一轮同步。";

  const boundaryLine =
    decision.decisionType === "CAN_DECIDE"
      ? "这部分我先自己推进并给你同步阶段结论。"
      : `边界上我先不替你拍板，${decision.recommendedEscalation.toLowerCase()}`;

  const riskLine =
    riskOrBlocker === "No immediate blocker identified."
      ? manager.riskTolerance === "low"
        ? " 当前没有明显 blocker，但我会继续盯风险变化。"
        : ""
      : manager.riskTolerance === "low"
        ? ` 当前风险是：${riskOrBlocker}，我会优先把它前置暴露。`
        : ` 当前风险是：${riskOrBlocker}`;

  const cadenceLine =
    manager.proactiveCadence === "push-often"
      ? " 我会主动多给你几次过程更新，不等你追问。"
      : manager.proactiveCadence === "daily"
        ? " 我会按天给你收敛后的进展。"
        : " 我会在关键节点给你里程碑更新。";

  return `${opener} ${densityLine} ${boundaryLine}${riskLine}${cadenceLine}`.trim();
}

/**
 * Work item pipeline
 * ------------------
 * raw message -> task inference -> boundary judgment -> execution plan -> manager-facing reply
 *
 * This stays deterministic on purpose for v1.
 * The important thing is not "AI magic". It is that the system always leaves behind
 * a durable, inspectable work object instead of a polite message that disappears.
 */
export function analyzeManagerMessage(
  rawMessage: string,
  manager: ManagerProfileInput,
): WorkItemDraft {
  const cleaned = compactText(rawMessage);
  const mainlineTask = inferMainlineTask(cleaned);
  const decision = inferDecision(cleaned);
  const mainlinePriority = inferPriority(cleaned);
  const timeline = buildTimeline(mainlinePriority);
  const neededResources = buildNeededResources(cleaned, decision);
  const riskOrBlocker = containsAny(cleaned.toLowerCase(), RISK_WORDS)
    ? "Manager explicitly signaled risk or blockage, so the next update should include mitigation."
    : "No immediate blocker identified.";
  const nextManagerUpdateAt = new Date();
  nextManagerUpdateAt.setHours(
    nextManagerUpdateAt.getHours() + computeNextUpdateHours(manager, mainlinePriority, decision),
  );

  return {
    mainlineTask,
    thinking:
      "The message needs to be converted into one clear mainline task so it does not get buried under unrelated work.",
    plan:
      decision.decisionType === "INSUFFICIENT_INFO"
        ? "Clarify the deliverable and owner before committing to execution."
        : "Acknowledge immediately, define the first action, and keep a visible follow-up loop alive.",
    timeline,
    expectedOutput:
      decision.decisionType === "MANAGER_APPROVAL_REQUIRED"
        ? "A short recommendation pack with explicit options and a request for manager approval."
        : "A visible next-step update plus a manager-facing response that reflects task ownership.",
    neededResources,
    decision,
    mainlinePriority,
    riskOrBlocker,
    replyDraft: buildReplyDraft(manager, mainlineTask, timeline, decision, riskOrBlocker),
    nextManagerUpdateAt,
    followUpTitle:
      decision.decisionType === "INSUFFICIENT_INFO"
        ? `Clarify scope for: ${mainlineTask}`
        : `Send next update for: ${mainlineTask}`,
  };
}
