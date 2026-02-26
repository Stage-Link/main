import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SignIn
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: "mx-auto",
            card: "shadow-none border border-white/10 bg-[#161412]",
          },
        }}
      />
    </div>
  );
}
