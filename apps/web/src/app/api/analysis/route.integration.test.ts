import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "redis";
import { pool as appPool } from "../../../lib/db";
import { closeRedisClientForTests } from "../../../lib/queue";

const shouldRun = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!shouldRun)("POST /api/analysis integration", () => {
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${encodeURIComponent(process.env.POSTGRES_USER ?? "analyst")}:${encodeURIComponent(
      process.env.POSTGRES_PASSWORD ?? "change-me-in-production"
    )}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${encodeURIComponent(
      process.env.POSTGRES_DB ?? "analyst_engine"
    )}`;
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const pool = new Pool({ connectionString: databaseUrl });
  const redis = createClient({ url: redisUrl });

  beforeAll(async () => {
    const initSql = fs.readFileSync(path.resolve(process.cwd(), "../../infra/db/init.sql"), "utf-8");
    await pool.query(initSql);
    await pool.query(
      "TRUNCATE chart_payloads, query_attempts, audit_events, analysis_requests RESTART IDENTITY CASCADE"
    );
    await redis.connect();
    await redis.flushDb();
  });

  afterAll(async () => {
    await closeRedisClientForTests();
    await appPool.end();
    await redis.quit();
    await pool.end();
  });

  it("persists an analysis request and appends one Redis Stream entry", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost:3000/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "slack",
          requester: "ops-lead",
          question: "Show revenue by month",
          semanticProfile: "saas"
        })
      })
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    const request = await pool.query("SELECT status, question FROM analysis_requests WHERE id = $1", [
      payload.analysisRequestId
    ]);
    const streamLength = await redis.xLen("analysis-requests");

    expect(request.rows[0]).toMatchObject({ status: "queued", question: "Show revenue by month" });
    expect(streamLength).toBe(1);
  });
});
