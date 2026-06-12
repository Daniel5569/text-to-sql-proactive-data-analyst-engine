import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/analysis", () => {
  class QueueAdmissionError extends Error {
    constructor(public readonly analysisRequestId: string) {
      super("queue_admission_failed");
    }
  }

  return {
    createAnalysisRequest: vi.fn(),
    QueueAdmissionError
  };
});

import { createAnalysisRequest, QueueAdmissionError } from "../../../lib/analysis";
import { POST } from "./route";

const body = {
  channel: "slack",
  organizationSlug: "demo-co",
  requester: "ops-lead",
  question: "Show revenue by month",
  semanticProfile: "saas"
};

function jsonRequest(payload: unknown) {
  return new Request("http://localhost:3000/api/analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

describe("POST /api/analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed requests", async () => {
    const response = await POST(jsonRequest({ question: "Show revenue" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_analysis_request" });
  });

  it("returns 400 for unsafe organization slugs", async () => {
    const response = await POST(jsonRequest({ ...body, organizationSlug: "../other-org" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_analysis_request" });
  });

  it("returns 202 when event admission succeeds", async () => {
    vi.mocked(createAnalysisRequest).mockResolvedValueOnce({
      analysisRequestId: "analysis-1",
      status: "queued"
    });

    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ analysisRequestId: "analysis-1", status: "queued" });
  });

  it("returns 503 when Redis admission fails", async () => {
    vi.mocked(createAnalysisRequest).mockRejectedValueOnce(new QueueAdmissionError("analysis-1"));

    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "queue_admission_failed",
      analysisRequestId: "analysis-1"
    });
  });
});
