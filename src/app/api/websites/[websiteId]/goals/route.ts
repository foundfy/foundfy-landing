import { NextResponse } from "next/server";
import { saveWebsiteGoals } from "@/lib/goals/save";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  try {
    const goals = await saveWebsiteGoals({
      websiteId,
      primaryType: record.primaryType,
      secondaryType: record.secondaryType,
      note: record.note,
    });

    return NextResponse.json({ goals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save website goals.";
    if (message === "Website not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message === "Confirm what Foundfy understands about this site first." ||
      message === "Choose what should happen when the right people find this site." ||
      message === "Add a short note so Foundfy knows what “something else” means."
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[Goals] Failed to save website goals:", message);
    return NextResponse.json(
      { error: "Unable to save this right now." },
      { status: 500 },
    );
  }
}
