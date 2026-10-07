import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { ApimError, deleteUser } from "@/lib/apim";
import { authorizeUserAction } from "@/lib/mobile-users";
import { requireSession } from "@/lib/require-session";

/** DELETE /api/mobile/users/{userId} — only when the shared rules allow this viewer to delete this user. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  try {
    const allowed = await authorizeUserAction(auth.session, auth.token, userId, "delete");
    if (!allowed.ok) return allowed.response;
    await deleteUser(userId, auth.token);
    revalidateTag("users", { expire: 0 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Delete failed. Please try again." }, { status: 500 });
  }
}
