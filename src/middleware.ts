import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/icon-64",
]);

const isHostRoute = createRouteMatcher(["/host(.*)"]);
const isViewerRoute = createRouteMatcher(["/viewer(.*)"]);
const isOrgSettingsRoute = createRouteMatcher(["/org-settings(.*)"]);
const isOrgSelectRoute = createRouteMatcher(["/org-select(.*)"]);
const isPricingRoute = createRouteMatcher(["/pricing(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  if (isHostRoute(request)) {
    const session = await auth.protect();
    const allowed =
      session.has({ permission: "org:stream:host" }) ||
      session.has({ role: "org:admin" }) ||
      session.has({ role: "org:stage_manager" });
    if (!allowed) {
      return new Response(null, { status: 403 });
    }
    return;
  }

  if (isOrgSettingsRoute(request)) {
    await auth.protect({ role: "org:admin" });
    return;
  }

  if (isOrgSelectRoute(request)) {
    await auth.protect();
    return;
  }

  if (isViewerRoute(request)) {
    await auth.protect();
    return;
  }

  if (isPricingRoute(request)) {
    await auth.protect();
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
