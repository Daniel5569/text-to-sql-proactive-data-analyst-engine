import { NextResponse } from "next/server";
import { getAnalysisRequest } from "../../../../lib/analysis";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const result = await getAnalysisRequest(params.id);
  if (!result.request) {
    return NextResponse.json({ error: "analysis_request_not_found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
