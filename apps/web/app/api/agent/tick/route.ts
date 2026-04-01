import { NextResponse } from "next/server";
import { runTick } from "@/lib/agent-tick";

export async function POST() {
  try {
    const result = await runTick();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/agent/tick]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
