import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const STUN_ONLY = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
};

export async function GET() {
  const { has, orgId } = await auth();

  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const canUseTurn = has({ feature: "turn_relay" });
  if (!canUseTurn) {
    return NextResponse.json(STUN_ONLY);
  }

  const keyId = process.env.TURN_KEY_ID;
  const apiToken = process.env.TURN_KEY_API_TOKEN;

  if (!keyId || !apiToken) {
    return NextResponse.json(
      { error: "TURN credentials not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }), // 24-hour credential lifetime
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Cloudflare TURN API error:", response.status, text);
      return NextResponse.json(
        { error: "Failed to generate TURN credentials" },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TURN credential fetch error:", error);
    return NextResponse.json(
      { error: "Failed to contact TURN service" },
      { status: 502 },
    );
  }
}
