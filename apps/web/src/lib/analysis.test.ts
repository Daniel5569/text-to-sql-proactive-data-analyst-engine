import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
  query: vi.fn(async () => ({ rows: [] })),
  release: vi.fn()
};

vi.mock("./db", () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id FROM organizations")) {
        return { rows: [{ id: "1" }] };
      }
      return { rows: [] };
    }),
    connect: vi.fn(async () => mockClient)
  }
}));

vi.mock("./queue", () => ({
  enqueueAnalysisRequest: vi.fn(async () => "stream-entry-1")
}));

import { pool } from "./db";
import { enqueueAnalysisRequest } from "./queue";
import { createAnalysisRequest, QueueAdmissionError } from "./analysis";

const input = {
  channel: "slack" as const,
  organizationSlug: "demo-co",
  requester: "ops-lead",
  question: "Show revenue by month",
  semanticProfile: "saas"
};

describe("analysis admission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.release.mockReset();
  });

  it("persists request state and enqueues async analysis", async () => {
    const result = await createAnalysisRequest(input);

    expect(result.status).toBe("queued");
    expect(enqueueAnalysisRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisRequestId: result.analysisRequestId,
        organizationSlug: "demo-co",
        semanticProfile: "saas"
      })
    );
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("marks request failed when Redis stream admission fails", async () => {
    vi.mocked(enqueueAnalysisRequest).mockRejectedValueOnce(new Error("redis down"));

    await expect(createAnalysisRequest(input)).rejects.toBeInstanceOf(QueueAdmissionError);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE analysis_requests"),
      expect.any(Array)
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("analysis.enqueue_failed"),
      expect.any(Array)
    );
  });
});
