import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { SessionUser } from "@sllights/shared/types";
import { ApimError, deleteUser } from "@/lib/apim";

/**
 * Deletes the signed-in person's OWN account — any role, Customer Owners
 * included. The account to delete is always the session's own id, never
 * one taken from the request, so this can't be pointed at anyone else.
 * (Deleting other people stays with /api/mobile/users/[userId] and its
 * rules.) Uses APIM's existing deleteUser, which allows deleting yourself.
 * Apple requires apps that support account creation to offer this.
 */
export async function deleteOwnAccount(session: SessionUser, token: string): Promise<NextResponse> {
  try {
    await deleteUser(session.id, token);
    revalidateTag("users", { expire: 0 });
    const response = NextResponse.json({ success: true });
    // The account is gone, so its session is too.
    response.cookies.delete("session");
    return response;
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }
}
