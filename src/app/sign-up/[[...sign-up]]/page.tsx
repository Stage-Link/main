import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000] p-4">
      <SignUp
        appearance={{
          baseTheme: dark,
          elements: {
            rootBox: "mx-auto",
            card: "shadow-none border border-white/10 bg-[#080808]",
          },
        }}
      />
    </div>
  );
}
