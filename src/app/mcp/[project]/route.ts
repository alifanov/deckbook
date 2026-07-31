import { handleMcpRequest } from "../../../mcp/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const { project } = await params;
  return handleMcpRequest(request, project);
}
