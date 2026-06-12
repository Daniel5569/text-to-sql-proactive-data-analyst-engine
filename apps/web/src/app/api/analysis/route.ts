import { NextResponse } from "next/server";
import { z } from "zod";
import { createAnalysisRequest, QueueAdmissionError } from "../../../lib/analysis";

const AnalysisRequestSchema = z.object({
  channel: z.enum(["slack", "api", "webhook"]),
  organizationSlug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  requester: z.string().min(1).max(120),
  question: z.string().min(1).max(2000),
  semanticProfile: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_analysis_request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await createAnalysisRequest(parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof QueueAdmissionError) {
      return NextResponse.json(
        { error: "queue_admission_failed", analysisRequestId: error.analysisRequestId },
        { status: 503 }
      );
    }
    console.error("analysis_admission_failed", error);
    return NextResponse.json({ error: "analysis_admission_failed" }, { status: 500 });
  }
}
