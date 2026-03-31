import { NextResponse, NextRequest } from "next/server";
import redis from "@/lib/redis";
const KEY = "flowvault:dao_expenses";

interface Expense {
  id: string;
  description: string;
  amountUSD: number;
  token: "USDC" | "USDT";
  dueDate: number;
  reserved: boolean;
}

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const raw = await redis.get(KEY);
    if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const expenses: Expense[] = JSON.parse(raw);
    const filtered = expenses.filter(e => e.id !== id);
    await redis.set(KEY, JSON.stringify(filtered));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const body = await req.json();
    const raw = await redis.get(KEY);
    if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const expenses: Expense[] = JSON.parse(raw);
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    expenses[idx] = { ...expenses[idx], ...body };
    await redis.set(KEY, JSON.stringify(expenses));
    return NextResponse.json(expenses[idx]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
