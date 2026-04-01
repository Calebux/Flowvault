import { NextResponse } from "next/server";
import { DEFAULT_DELEGATION_RULES } from "@flowvault/shared";

import redis from "@/lib/redis";

export async function GET() {
  const raw = await redis.get("flowvault:delegation_rules");
  return NextResponse.json(raw ? JSON.parse(raw) : DEFAULT_DELEGATION_RULES);
}

export async function POST(req: Request) {
  const rules = await req.json();
  await redis.set("flowvault:delegation_rules", JSON.stringify(rules));
  return NextResponse.json({ success: true });
}
