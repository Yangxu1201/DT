import clsx from "clsx";
import { ensureDatabaseReady } from "@/lib/bootstrap";
import { buildReportSummaries } from "@/lib/reports";
import { prisma } from "@/lib/db";
import { isLlmAvailable } from "@/lib/llm";
import {
  addFollowUpAction,
  createWorkItemAction,
  rerunWorkItemAnalysisAction,
  updateFollowUpStatusAction,
  updateManagerProfileAction,
  updateWorkItemAction,
  updateWorkItemStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDatabaseReady();

  const managerProfile = await prisma.managerProfile.findFirst();
  const llmAvailable = isLlmAvailable();
  const workItems = await prisma.workItem.findMany({
    include: {
      followUps: {
        orderBy: { dueAt: "asc" },
      },
      managerProfile: true,
    },
    orderBy: [{ nextManagerUpdateAt: "asc" }, { createdAt: "desc" }],
  });
  const reports = buildReportSummaries(workItems);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">DT v1</p>
          <h1>Turn vague manager messages into durable work, not polite silence.</h1>
          <p className="lede">
            This prototype takes one manager message, creates a structured work item,
            marks the decision boundary, drafts a manager-facing reply, and leaves
            behind a follow-up that does not disappear.
          </p>
          <p className="llm-pill">
            AI rewrite: {llmAvailable ? "enabled via OpenAI Responses API" : "disabled, deterministic fallback"}
          </p>
        </div>

        <div className="manager-card">
          <p className="manager-label">Current manager profile</p>
          <form action={updateManagerProfileAction} className="stack compact">
            {managerProfile ? <input type="hidden" name="profileId" value={managerProfile.id} /> : null}

            <label className="field compact">
              <span>Manager name</span>
              <input
                type="text"
                name="name"
                defaultValue={managerProfile?.name ?? "Rule-setting remote manager"}
                required
              />
            </label>

            <div className="inline-fields">
              <label className="field compact">
                <span>Response in</span>
                <input
                  type="number"
                  name="responseLatencyHours"
                  min={1}
                  max={72}
                  defaultValue={managerProfile?.responseLatencyHours ?? 6}
                  required
                />
              </label>

              <label className="field compact">
                <span>Info density</span>
                <select name="infoDensity" defaultValue={managerProfile?.infoDensity ?? "high"}>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>

            <div className="inline-fields">
              <label className="field compact">
                <span>Proactive cadence</span>
                <select
                  name="proactiveCadence"
                  defaultValue={managerProfile?.proactiveCadence ?? "push-often"}
                >
                  <option value="push-often">push-often</option>
                  <option value="daily">daily</option>
                  <option value="milestone">milestone</option>
                </select>
              </label>

              <label className="field compact">
                <span>Risk tolerance</span>
                <select name="riskTolerance" defaultValue={managerProfile?.riskTolerance ?? "low"}>
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
                defaultValue={String(managerProfile?.prefersConclusionFirst ?? true)}
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
                defaultValue={
                  managerProfile?.notes ??
                  "Wants frequent visible updates, low patience, and proactive communication."
                }
              />
            </label>

            <button type="submit" className="secondary-button">
              Save manager profile
            </button>
          </form>
        </div>
      </section>

      <section className="grid">
        <section className="panel panel-form">
          <div className="panel-header">
            <p className="eyebrow">Manual message intake</p>
            <h2>Paste one manager instruction</h2>
          </div>

          <form action={createWorkItemAction} className="stack">
            <label className="field">
              <span>Manager message</span>
              <textarea
                name="rawMessage"
                rows={7}
                placeholder="Example: Tonight please send me the project risk summary and tell me whether we should change supplier."
                required
              />
            </label>

            <label className="field">
              <span>Optional context</span>
              <textarea
                name="conversationContext"
                rows={4}
                placeholder="Any useful context from prior chats or current workload."
              />
            </label>

            <button type="submit" className="primary-button">
              Create structured work item
            </button>
          </form>
        </section>

        <section className="panel panel-reports">
          <div className="panel-header">
            <p className="eyebrow">Shared report pipeline</p>
            <h2>Daily / Weekly / Monthly snapshots</h2>
          </div>

          <div className="report-grid">
            {Object.values(reports).map((report) => (
              <article key={report.title} className="report-card">
                <h3>{report.title}</h3>
                <dl>
                  <div>
                    <dt>Total</dt>
                    <dd>{report.totalItems}</dd>
                  </div>
                  <div>
                    <dt>Done</dt>
                    <dd>{report.completedItems}</dd>
                  </div>
                  <div>
                    <dt>Waiting</dt>
                    <dd>{report.waitingItems}</dd>
                  </div>
                  <div>
                    <dt>Blocked</dt>
                    <dd>{report.blockedItems}</dd>
                  </div>
                  <div>
                    <dt>Overdue</dt>
                    <dd>{report.overdueFollowUps}</dd>
                  </div>
                </dl>
                <ul className="key-lines">
                  {report.keyLines.length > 0 ? (
                    report.keyLines.map((line) => <li key={line}>{line}</li>)
                  ) : (
                    <li>No work items in this window yet.</li>
                  )}
                </ul>
                <label className="field compact report-prose">
                  <span>Copyable summary</span>
                  <textarea readOnly value={report.prose} rows={6} />
                </label>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Durable work items</p>
          <h2>Everything visible, tracked, and explainable</h2>
        </div>

        <div className="work-list">
          {workItems.length > 0 ? (
            workItems.map((item) => (
              <article key={item.id} className="work-card">
                <div className="work-card-header">
                  <div>
                    <p className="priority-pill">{item.mainlinePriority}</p>
                    <h3>{item.mainlineTask}</h3>
                    <p className="small-copy">Analysis v{item.analysisVersion}</p>
                  </div>
                  <div className="meta-stack">
                    <span className={clsx("status-pill", item.workStatus.toLowerCase())}>
                      {item.workStatus.replaceAll("_", " ")}
                    </span>
                    <span className="status-pill outline">
                      {item.decisionType.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>

                <p className="raw-message">“{item.rawMessage}”</p>

                <form action={rerunWorkItemAnalysisAction} className="rerun-form">
                  <input type="hidden" name="workItemId" value={item.id} />
                  <button type="submit" className="secondary-button">
                    Re-run with current manager profile
                  </button>
                </form>

                <form action={updateWorkItemAction} className="editor-box">
                  <input type="hidden" name="workItemId" value={item.id} />

                  <div className="detail-grid">
                    <label className="field compact">
                      <span>Thinking</span>
                      <textarea name="thinking" defaultValue={item.thinking} rows={4} />
                    </label>
                    <label className="field compact">
                      <span>Plan</span>
                      <textarea name="plan" defaultValue={item.plan} rows={4} />
                    </label>
                    <label className="field compact">
                      <span>Timeline</span>
                      <textarea name="timeline" defaultValue={item.timeline} rows={4} />
                    </label>
                    <label className="field compact">
                      <span>Expected output</span>
                      <textarea name="expectedOutput" defaultValue={item.expectedOutput} rows={4} />
                    </label>
                    <section>
                      <h4>Boundary reasoning</h4>
                      <p>{item.decisionReasoning}</p>
                      <p className="small-copy">Confidence: {item.decisionConfidence}/100</p>
                    </section>
                    <section>
                      <h4>Escalation</h4>
                      <p>{item.recommendedEscalation}</p>
                    </section>
                  </div>

                  <div className="reply-box">
                    <label className="field compact">
                      <span>Risk or blocker</span>
                      <textarea name="riskOrBlocker" defaultValue={item.riskOrBlocker} rows={3} />
                    </label>
                    <label className="field compact">
                      <span>Reply draft</span>
                      <textarea name="replyDraft" defaultValue={item.replyDraft} rows={5} />
                    </label>
                    <button type="submit" className="secondary-button">
                      Save work item edits
                    </button>
                  </div>
                </form>

                <div className="follow-up-box">
                  <div className="status-row">
                    <div>
                      <h4>Work status</h4>
                      <p>Move the item through a real working state, not just follow-up buttons.</p>
                    </div>
                    <form action={updateWorkItemStatusAction} className="status-form">
                      <input type="hidden" name="workItemId" value={item.id} />
                      <select name="workStatus" defaultValue={item.workStatus}>
                        <option value="DRAFT">DRAFT</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="WAITING_ON_MANAGER">WAITING_ON_MANAGER</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="COMPLETE">COMPLETE</option>
                      </select>
                      <button type="submit">Update status</button>
                    </form>
                  </div>

                  <div>
                    <h4>Follow-up loop</h4>
                    <p>
                      Next manager update due{" "}
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(item.nextManagerUpdateAt)}
                    </p>
                  </div>

                  <form action={addFollowUpAction} className="add-follow-up-form">
                    <input type="hidden" name="workItemId" value={item.id} />
                    <label className="field compact">
                      <span>New follow-up title</span>
                      <input
                        type="text"
                        name="title"
                        placeholder="Example: send supplier option package"
                        required
                      />
                    </label>
                    <label className="field compact">
                      <span>Due at</span>
                      <input type="datetime-local" name="dueAt" required />
                    </label>
                    <button type="submit" className="secondary-button">
                      Add follow-up
                    </button>
                  </form>

                  <div className="follow-up-list">
                    {item.followUps.map((followUp) => (
                      <form key={followUp.id} action={updateFollowUpStatusAction} className="follow-up-item">
                        <input type="hidden" name="followUpId" value={followUp.id} />
                        <div>
                          <strong>{followUp.title}</strong>
                          <p>
                            Due{" "}
                            {new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(followUp.dueAt)}
                          </p>
                        </div>
                        <div className="follow-up-actions">
                          <button type="submit" name="status" value="DONE">
                            Done
                          </button>
                          <button type="submit" name="status" value="MISSED">
                            Missed
                          </button>
                          <button type="submit" name="status" value="PENDING">
                            Pending
                          </button>
                        </div>
                      </form>
                    ))}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>No work items yet.</h3>
              <p>
                Paste one real manager message above. The first work item will also create
                the default manager profile and seed the report pipeline.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
