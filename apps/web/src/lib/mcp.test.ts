import { describe, expect, it } from "vitest";
import { getMcpTools } from "./mcp";

describe("MCP tool registry", () => {
  it("exposes stable analyst tool contracts", () => {
    const tools = getMcpTools();

    expect(tools.map((tool) => tool.name)).toEqual(["submit_analysis_request", "get_analysis_status"]);
    expect(tools[0].inputSchema).toMatchObject({
      type: "object",
      required: ["channel", "requester", "question", "semanticProfile"]
    });
  });
});
