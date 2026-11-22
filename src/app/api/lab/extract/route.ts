import { NextResponse } from "next/server";
import { badRequest, limitAi } from "@/lib/api";
import { ALLOWED_IMAGE_TYPES, extractLabValues, ExtractionUnavailableError, MAX_IMAGE_BYTES } from "@/lib/ai/extract";

/**
 * Accepts multipart/form-data with an `image` file. The image is held in memory only and is
 * never written to disk or storage; it is discarded as soon as extraction finishes.
 */
export async function POST(req: Request) {
  const limited = limitAi(req, "lab-extract", 6);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Send the photo as multipart/form-data with field `image`");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return badRequest("Missing `image` file");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return badRequest(`Unsupported image type: ${file.type || "unknown"}`);
  if (file.size === 0) return badRequest("Image is empty");
  if (file.size > MAX_IMAGE_BYTES) return badRequest("Image is too large (max 8 MB)");

  let image: Buffer | null = Buffer.from(await file.arrayBuffer());
  try {
    const values = await extractLabValues(image, file.type);
    return NextResponse.json({ values, imageDeleted: true });
  } catch (e) {
    if (e instanceof ExtractionUnavailableError)
      return NextResponse.json({ error: "ai_unavailable", values: [], imageDeleted: true }, { status: 503 });
    throw e;
  } finally {
    image.fill(0);
    image = null; // drop the only reference — nothing is persisted
  }
}
