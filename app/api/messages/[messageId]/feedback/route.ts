import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type FeedbackValue = 1 | -1 | null;

function isValidFeedback(value: unknown): value is FeedbackValue {
  return value === 1 || value === -1 || value === null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const safeMessageId = messageId.trim();

  if (!safeMessageId) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const body = await req.json();
  const feedback = (body?.feedback ?? null) as FeedbackValue;

  if (!isValidFeedback(feedback)) {
    return NextResponse.json({ error: "Invalid feedback value" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: existingMessage, error: fetchError } = await supabase
    .from("messages")
    .select("id, sender")
    .eq("id", safeMessageId)
    .single();

  if (fetchError || !existingMessage) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (existingMessage.sender !== "agent") {
    return NextResponse.json({ error: "Feedback is only allowed on agent messages" }, { status: 400 });
  }

  const userFeedbackAt = feedback === null ? null : Date.now();

  const { data: updatedMessage, error: updateError } = await supabase
    .from("messages")
    .update({
      user_feedback: feedback,
      user_feedback_at: userFeedbackAt,
    })
    .eq("id", safeMessageId)
    .select("id, user_feedback, user_feedback_at")
    .single();

  if (updateError || !updatedMessage) {
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }

  return NextResponse.json({
    id: updatedMessage.id,
    userFeedback: updatedMessage.user_feedback,
    userFeedbackAt: updatedMessage.user_feedback_at,
  });
}