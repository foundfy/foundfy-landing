import { NextResponse } from "next/server";
import { sendEarlyAccessNotification } from "@/lib/early-access/email";
import { insertEarlyAccessLead } from "@/lib/early-access/supabase";
import { validateEarlyAccessPayload } from "@/lib/early-access/validation";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const validation = validateEarlyAccessPayload(payload);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const lead = await insertEarlyAccessLead(validation.data);

    try {
      await sendEarlyAccessNotification(validation.data, lead.created_at);
    } catch (emailError) {
      console.error(
        "[Early Access] Notification email failed:",
        emailError instanceof Error ? emailError.message : "Unknown error",
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(
      "[Early Access] Submission failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
