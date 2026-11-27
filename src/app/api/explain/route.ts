import { NextResponse } from "next/server";
import { explainInputSchema } from "@/domain/schemas";
import { badRequest, limitAi, readJson, zodError } from "@/server/http/api";
import { explain } from "@/server/ai/explain";

export async function POST(req: Request) {
  const limited = limitAi(req, "explain", 15);
  if (limited) return limited;

  const body = await readJson(req);
  if (!body.ok) return badRequest("Request body must be JSON");
  const parsed = explainInputSchema.safeParse(body.data);
  if (!parsed.success) return zodError(parsed.error);
  if (parsed.data.kind === "risk" && !parsed.data.risk) return badRequest("`risk` is required when kind is 'risk'");
  if (parsed.data.kind === "lab" && !parsed.data.lab?.length) return badRequest("`lab` is required when kind is 'lab'");

  return NextResponse.json(await explain(parsed.data));
}
