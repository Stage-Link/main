export {};

declare global {
  interface ClerkAuthorization {
    permission: "org:stream:host" | "org:stream:view";
    role: "org:admin" | "org:stage_manager" | "org:member";
  }
}
