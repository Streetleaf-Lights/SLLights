import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] px-4">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
