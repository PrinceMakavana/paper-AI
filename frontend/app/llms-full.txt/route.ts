import { buildLlmsFullTxt, llmsPlainTextResponse } from "@/lib/seo/llms";

export const dynamic = "force-static";

export async function GET() {
  const body = await buildLlmsFullTxt();
  return llmsPlainTextResponse(body);
}
