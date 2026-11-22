import { NextResponse } from "next/server";
import { labEvaluateInputSchema } from "@/lib/schemas";
import { badRequest, readJson, zodError } from "@/lib/api";
import { evaluateLabValue } from "@/lib/scoring/labRanges";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body.ok) return badRequest("Request body must be JSON");
  const parsed = labEvaluateInputSchema.safeParse(body.data);
  if (!parsed.success) return zodError(parsed.error);
  return NextResponse.json({ results: parsed.data.values.map(evaluateLabValue) });
}
