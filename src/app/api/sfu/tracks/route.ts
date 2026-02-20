import { NextResponse } from "next/server";

const CALLS_API = "https://rtc.live.cloudflare.com/apps";

/**
 * POST /api/sfu/tracks — Push or pull tracks on a Cloudflare Calls SFU session.
 *
 * Body: {
 *   sessionId: string,
 *   tracks: [{
 *     location: 'local' | 'remote',
 *     trackName: string,
 *     sessionId?: string,          // remote session ID (for pull)
 *     sessionDescription?: { type: string, sdp: string },
 *   }]
 * }
 */
export async function POST(request: Request) {
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
    const { sessionId, ...rest } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const cfBody = JSON.stringify(rest);
    console.log("SFU tracks request ->", `${CALLS_API}/${appId}/sessions/${sessionId}/tracks/new`);
    console.log("SFU tracks body ->", cfBody);

    const res = await fetch(
      `${CALLS_API}/${appId}/sessions/${sessionId}/tracks/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
        body: cfBody,
      },
    );

    const text = await res.text();
    console.log("SFU tracks response <-", res.status, text);

    if (!res.ok) {
      console.error("Cloudflare SFU tracks error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to manage SFU tracks", detail: text },
        { status: 502 },
      );
    }

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error) {
    console.error("SFU tracks error:", error);
    return NextResponse.json(
      { error: "Failed to contact SFU service" },
      { status: 502 },
    );
  }
}
