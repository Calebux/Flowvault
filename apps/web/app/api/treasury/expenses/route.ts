import { NextResponse, NextRequest } from "next/server";
import Redis from "ioredis";
import { randomUUID } from "crypto";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const KEY = "flowvault:dao_expenses";

interface Expense {
  id: string;
  description: string;
  amountUSD: number;
  token: "USDC" | "USDT";
  dueDate: number;
  reserved: boolean;
}

function defaultExpenses(): Expense[] {
  const now = Date.now();
  return [
    { id: "exp-1", description: "Q2 Contributor Payroll", amountUSD: 45000, token: "USDC", dueDate: now + 32 * 86400_000, reserved: true },
    { id: "exp-2", description: "Audit Retainer — Trail of Bits", amountUSD: 25000, token: "USDC", dueDate: now + 58 * 86400_000, reserved: true },
    { id: "exp-3", description: "Community Grants — Round 3", amountUSD: 15000, token: "USDT", dueDate: now + 75 * 86400_000, reserved: false },
    { id: "exp-4", description: "Protocol Insurance Premium", amountUSD: 8000, token: "USDC", dueDate: now + 90 * 86400_000, reserved: false },
  ];
}

export async function GET() {
  try {
    const raw = await redis.get(KEY);
    if (!raw) {
      const defaults = defaultExpenses();
      await redis.set(KEY, JSON.stringify(defaults));
      return NextResponse.json(defaults);
    }
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(defaultExpenses());
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = await redis.get(KEY);
    const expenses: Expense[] = raw ? JSON.parse(raw) : defaultExpenses();

    const newExpense: Expense = {
      id: `exp-${randomUUID().slice(0, 8)}`,
      description: String(body.description ?? "New Expense").slice(0, 100),
      amountUSD: Math.max(0, Number(body.amountUSD) || 0),
      token: body.token === "USDT" ? "USDT" : "USDC",
      dueDate: body.dueDate ? Number(body.dueDate) : Date.now() + 30 * 86400_000,
      reserved: false,
    };

    expenses.push(newExpense);
    await redis.set(KEY, JSON.stringify(expenses));
    return NextResponse.json(newExpense);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
