import { NextResponse } from "next/server";
import { SelfBackendVerifier, DefaultConfigStore } from "@selfxyz/core";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const scope = process.env.SELF_APP_SCOPE ?? "mentoguard";
const endpoint =
  process.env.SELF_VERIFICATION_ENDPOINT ?? "http://localhost:3000/api/self/verify";

const configStore = new DefaultConfigStore({
  minimumAge: 18,
  ofac: true,
});

const verifier = new SelfBackendVerifier(
  scope,
  endpoint,
  process.env.NODE_ENV !== "production", // mock passports in dev
  new Map([[1, true]]),
  configStore,
  "uuid"
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attestationId, proof, publicSignals, userContextData } = body;

    const result = await verifier.verify(attestationId, proof, publicSignals, userContextData);

    if (!result.isValidDetails.isValid) {
      return NextResponse.json({ verified: false, reason: "Invalid proof" }, { status: 400 });
    }

    // Persist verified status in Redis — agent reads this when loading user config
    try {
      const cfg = await redis.get("mentoguard:user_config");
      const config = cfg ? JSON.parse(cfg) : {};
      config.selfVerified = true;
      config.selfNullifier = result.discloseOutput.nullifier;
      await redis.set("mentoguard:user_config", JSON.stringify(config));
    } catch (redisErr) {
      console.warn("[self-verify] Redis save failed:", redisErr);
    }

    return NextResponse.json({
      verified: true,
      nullifier: result.discloseOutput.nullifier,
    });
  } catch (err) {
    console.error("[self-verify] Error:", err);
    return NextResponse.json({ verified: false, reason: "Verification failed" }, { status: 500 });
  }
}
