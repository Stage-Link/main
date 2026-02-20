import { NextResponse } from "next/server";

const CALLS_API = "https://rtc.live.cloudflare.com/apps";

/**
 * PUT /api/sfu/renegotiate — Handle renegotiation for a Cloudflare Calls SFU session.
 * Called when Cloudflare needs to update the session (e.g., tracks added/removed).
 *
 * Body: {
 *   sessionId: string,
 *   sessionDescription: { type: string, sdp: string }
 * }
 */
export async function PUT(request: Request) {
  const appId = process.env.CALLS_APP_ID;
  const appSecret = process.env.CALLS_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "SFU credentials not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { sessionId, sessionDescription } = body;

    if (!sessionId || !sessionDescription) {
      return NextResponse.json(
        { error: "sessionId and sessionDescription are required" },
        { status: 400 },
      );
    }

    const res = await fetch(
      `${CALLS_API}/${appId}/sessions/${sessionId}/renegotiate`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionDescription }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Cloudflare SFU renegotiate error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to renegotiate SFU session" },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("SFU renegotiate error:", error);
    return NextResponse.json(
      { error: "Failed to contact SFU service" },
      { status: 502 },
    );
  }
}
