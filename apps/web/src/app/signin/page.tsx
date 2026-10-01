import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] px-4">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
