import { NextResponse } from "next/server";
import { getMcpTools } from "../../../../lib/mcp";

export async function GET() {
  return NextResponse.json({
    protocol: "model-context-protocol-compatible",
    tools: getMcpTools()
  });
}
