import { NextResponse } from "next/server";
import { riskInputSchema } from "@/lib/schemas";
import { badRequest, readJson, zodError } from "@/lib/api";
import { runRiskCheck } from "@/lib/risk";
import { saveScreening } from "@/lib/screenings";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (!rateLimit(`risk:${clientIp(req)}`, 30, 60_000).ok)
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });

  const body = await readJson(req);
  if (!body.ok) return badRequest("Request body must be JSON");
  const parsed = riskInputSchema.safeParse(body.data);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;
  const result = runRiskCheck(input);
  const saved = input.save
    ? await saveScreening(result, { channel: input.channel, province: input.province, orgCode: input.orgCode })
    : false;

  return NextResponse.json({ ...result, saved });
}
