/**
 * Durable wait + finish for plate generation. HTTP still submits to the provider
 * (startPageGenerate); this Workflow polls until the plate is on R2 even if the
 * editor tab closes. Payload is only `{ jobId }` — no image bytes.
 */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { recordImageCredit, tickGenerateJob } from "./generatePage";
import type { Env } from "./types";

export type GeneratePageParams = { jobId: string };

const MAX_TICKS = 90;
const WAIT = "8 seconds";

export class GeneratePageWorkflow extends WorkflowEntrypoint<Env, GeneratePageParams> {
  async run(event: WorkflowEvent<GeneratePageParams>, step: WorkflowStep) {
    const jobId = event.payload.jobId;
    for (let i = 0; i < MAX_TICKS; i++) {
      const tick = await step.do(`tick-${i}`, async () => tickGenerateJob(this.env, jobId));
      if (tick.done) {
        if (tick.status === "done" && tick.createdBy) {
          await step.do("credit", async () => {
            try {
              await recordImageCredit(this.env, tick.createdBy!, tick.count);
            } catch {
              /* credit row is secondary */
            }
            return { ok: true as const };
          });
        }
        return tick;
      }
      await step.sleep(`wait-${i}`, WAIT);
    }
    await step.do("timeout", async () => {
      await this.env.DB.prepare(
        `UPDATE generation_jobs SET status = 'error', error = ?, updated_at = ? WHERE id = ? AND status = 'running'`
      )
        .bind("Timed out waiting for the generation", new Date().toISOString(), jobId)
        .run();
      return { ok: false as const };
    });
    return { done: true, status: "error", createdBy: null, count: 1 };
  }
}

export async function launchGenerateWorkflow(env: Env, jobId: string): Promise<void> {
  if (!env.GENERATE_PAGE) return;
  try {
    await env.GENERATE_PAGE.create({ id: jobId, params: { jobId } });
  } catch (err) {
    console.error("generate workflow start failed", err);
  }
}

/** True while a Workflow instance is still driving this job — GET /jobs should not also poll. */
export async function generateWorkflowActive(env: Env, jobId: string): Promise<boolean> {
  if (!env.GENERATE_PAGE) return false;
  try {
    const inst = await env.GENERATE_PAGE.get(jobId);
    const st = await inst.status();
    return st.status === "running" || st.status === "queued" || st.status === "waiting" || st.status === "paused";
  } catch {
    return false;
  }
}
