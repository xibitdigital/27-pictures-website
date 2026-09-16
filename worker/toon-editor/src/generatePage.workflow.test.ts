import { describe, expect, it } from "vitest";
import { jobClientFields, phaseFromJob, type GenerationJob } from "./generatePage";

function job(over: Partial<GenerationJob>): GenerationJob {
  return {
    id: "j1",
    kind: "page",
    toon_id: "t1",
    page_id: null,
    region_id: null,
    provider: "comfy",
    status: "running",
    prompt: "x",
    payload_json: "{}",
    error: null,
    result_page_id: null,
    comfy_prompt_id: "p1",
    created_by: "u1",
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("generation job phase for GET /jobs", () => {
  it("reads queued/running from payload while the workflow owns the poll", () => {
    expect(phaseFromJob(job({ payload_json: JSON.stringify({ phase: "queued" }) }))).toBe("queued");
    expect(phaseFromJob(job({ payload_json: JSON.stringify({ phase: "running", count: 2 }) }))).toBe("running");
  });

  it("maps terminal status without a payload phase", () => {
    expect(phaseFromJob(job({ status: "done" }))).toBe("done");
    expect(phaseFromJob(job({ status: "error" }))).toBe("error");
  });

  it("wording for a multi-plate queue wait", () => {
    const fields = jobClientFields(job({ payload_json: JSON.stringify({ count: 3, phase: "queued" }) }), "queued");
    expect(fields.message).toContain("3 plates");
    expect(fields.comfyStatus).toBe("queued");
  });
});
