import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasFullAccessBySlug } from "@/lib/billing/plans";

const CALLS_API = "https://rtc.live.cloudflare.com/apps";

/**
 * POST /api/sfu/session — Create a new Cloudflare Calls SFU session.
 * Each host and viewer gets their own session.
 */
export async function POST() {
  const { orgId, orgSlug, has } = await auth();

  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const sfuAllowed =
    has({ feature: "sfu_access" }) || hasFullAccessBySlug(orgSlug ?? undefined);
  if (!sfuAllowed) {
    return NextResponse.json(
      { error: "SFU access requires a Production or Showtime plan" },
      { status: 403 },
    );
  }

  const appId = process.env.CALLS_APP_ID;
  const appSecret = process.env.CALLS_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "SFU credentials not configured" },
      { status: 500 },
    );
  }

  try {
    // Cloudflare Calls API: POST /sessions/new with NO body creates a new session.
    // Sending an empty JSON object {} causes a validation error because the API
    // expects a sessionDescription field if a body is provided.
    // Reference: Orange Meets (github.com/cloudflare/orange) CallsNewSession()
    const res = await fetch(`${CALLS_API}/${appId}/sessions/new`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appSecret}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Cloudflare SFU session error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to create SFU session" },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("SFU session error:", error);
    return NextResponse.json(
      { error: "Failed to contact SFU service" },
      { status: 502 },
    );
  }
}
