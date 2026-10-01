import { redirect } from "next/navigation";
import { getSessionUser, homeRouteForRole } from "@/lib/session";

export default async function Home() {
  const sessionUser = await getSessionUser();
  redirect(homeRouteForRole(sessionUser?.role, sessionUser?.customerId));
}
