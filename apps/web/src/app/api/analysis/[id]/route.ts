import { NextResponse } from "next/server";
import { getAnalysisRequest } from "../../../../lib/analysis";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "analysis_request_not_found" }, { status: 404 });
  }
  const result = await getAnalysisRequest(params.id);
  if (!result.request) {
    return NextResponse.json({ error: "analysis_request_not_found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
