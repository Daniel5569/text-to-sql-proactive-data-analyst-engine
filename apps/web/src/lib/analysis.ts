import crypto from "node:crypto";
import { pool } from "./db";
import { enqueueAnalysisRequest } from "./queue";

export class QueueAdmissionError extends Error {
  constructor(public readonly analysisRequestId: string) {
    super("queue_admission_failed");
    this.name = "QueueAdmissionError";
  }
}

export type AnalysisChannel = "slack" | "api" | "webhook";

export type CreateAnalysisInput = {
  channel: AnalysisChannel;
  organizationSlug: string;
  requester: string;
  question: string;
  semanticProfile: string;
};

export async function createAnalysisRequest(input: CreateAnalysisInput) {
  const analysisRequestId = crypto.randomUUID();

  const orgResult = await pool.query<{ id: string }>("SELECT id FROM organizations WHERE slug = $1", [
    input.organizationSlug
  ]);
  const organizationId = orgResult.rows[0]?.id;
  if (!organizationId) {
    throw new Error("organization_not_seeded");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO analysis_requests
        (id, organization_id, channel, requester, question, semantic_profile, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued')`,
      [
        analysisRequestId,
        organizationId,
        input.channel,
        input.requester,
        input.question,
        input.semanticProfile
      ]
    );
    await client.query(
      `INSERT INTO audit_events (analysis_request_id, event_type, payload_json)
       VALUES ($1, 'analysis.accepted', $2)`,
      [
        analysisRequestId,
        JSON.stringify({
          channel: input.channel,
          organizationSlug: input.organizationSlug,
          requester: input.requester,
          semanticProfile: input.semanticProfile
        })
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await enqueueAnalysisRequest({
      analysisRequestId,
      organizationSlug: input.organizationSlug,
      semanticProfile: input.semanticProfile
    });
  } catch (error) {
    await pool.query(`UPDATE analysis_requests SET status = 'failed', updated_at = now() WHERE id = $1`, [
      analysisRequestId
    ]);
    await pool.query(
      `INSERT INTO audit_events (analysis_request_id, event_type, payload_json)
       VALUES ($1, 'analysis.enqueue_failed', $2)`,
      [analysisRequestId, JSON.stringify({ message: error instanceof Error ? error.message : "unknown" })]
    );
    throw new QueueAdmissionError(analysisRequestId);
  }

  return { analysisRequestId, status: "queued" as const };
}

export async function getAnalysisRequest(analysisRequestId: string) {
  const request = await pool.query("SELECT * FROM analysis_requests WHERE id = $1", [analysisRequestId]);
  const attempts = await pool.query(
    "SELECT * FROM query_attempts WHERE analysis_request_id = $1 ORDER BY id ASC",
    [analysisRequestId]
  );
  const charts = await pool.query(
    "SELECT * FROM chart_payloads WHERE analysis_request_id = $1 ORDER BY id ASC",
    [analysisRequestId]
  );
  const events = await pool.query(
    "SELECT event_type, payload_json, created_at FROM audit_events WHERE analysis_request_id = $1 ORDER BY id ASC",
    [analysisRequestId]
  );

  return {
    request: request.rows[0] ?? null,
    attempts: attempts.rows,
    charts: charts.rows,
    events: events.rows
  };
}
