import { NextResponse } from "next/server";
import { getQuizById } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const quiz = await getQuizById(id);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  return NextResponse.json(quiz);
}
