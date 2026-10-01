import { Suspense } from "react";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] px-4">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
