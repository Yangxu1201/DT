import OpenAI from "openai";
import { z } from "zod";
import type { ManagerProfileInput, WorkItemDraft } from "./analysis";

const enhancementSchema = z.object({
  thinking: z.string().min(3),
  plan: z.string().min(3),
  timeline: z.string().min(3),
  expectedOutput: z.string().min(3),
  riskOrBlocker: z.string().min(3),
  replyDraft: z.string().min(3),
});

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function stripCodeFence(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function safeParseEnhancement(text: string) {
  try {
    const payload = JSON.parse(stripCodeFence(text));
    return enhancementSchema.parse(payload);
  } catch {
    return null;
  }
}

export function isLlmAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * LLM enhancement layer
 * ---------------------
 * We keep the deterministic pipeline as the source of truth.
 * If an OpenAI key exists, we ask the model to rewrite the human-facing fields so they
 * better match the manager profile. If anything fails, we keep the deterministic draft.
 */
export async function enhanceDraftWithLlm(args: {
  rawMessage: string;
  manager: ManagerProfileInput;
  draft: WorkItemDraft;
}) {
  const client = getClient();

  if (!client) {
    return {
      draft: args.draft,
      source: "deterministic" as const,
    };
  }

  try {
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You rewrite structured manager-update drafts for workplace communication. Return only valid JSON with keys: thinking, plan, timeline, expectedOutput, riskOrBlocker, replyDraft. Keep meaning grounded in the provided deterministic draft. Do not invent authority the subordinate does not have. Make the reply feel aligned to the manager profile.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                rawMessage: args.rawMessage,
                managerProfile: args.manager,
                deterministicDraft: args.draft,
              }),
            },
          ],
        },
      ],
    });

    const parsed = safeParseEnhancement(response.output_text);

    if (!parsed) {
      return {
        draft: args.draft,
        source: "deterministic" as const,
      };
    }

    return {
      source: "openai" as const,
      draft: {
        ...args.draft,
        ...parsed,
      },
    };
  } catch {
    return {
      draft: args.draft,
      source: "deterministic" as const,
    };
  }
}
