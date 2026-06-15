export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export function getMcpTools(): McpTool[] {
  return [
    {
      name: "submit_analysis_request",
      description:
        "Submit a natural-language business question for asynchronous semantic-layer SQL analysis.",
      inputSchema: {
        type: "object",
        required: ["channel", "organizationSlug", "requester", "question", "semanticProfile"],
        properties: {
          channel: { type: "string", enum: ["slack", "api", "webhook"] },
          organizationSlug: { type: "string" },
          requester: { type: "string" },
          question: { type: "string" },
          semanticProfile: { type: "string" }
        }
      }
    },
    {
      name: "get_analysis_status",
      description: "Fetch request status, SQL attempts, and chart payloads for a submitted analysis request.",
      inputSchema: {
        type: "object",
        required: ["analysisRequestId"],
        properties: {
          analysisRequestId: { type: "string", format: "uuid" }
        }
      }
    }
  ];
}
