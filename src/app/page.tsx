import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

export default async function RootPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("mc_payroll_session");

  if (!sessionCookie) {
    redirect("/payroll/login");
  }

  const context = await getSessionContext(sessionCookie.value);
  if (!context) {
    redirect("/payroll/login");
  }

  if (context.isSuperAdmin || context.effectivePermissions.includes("portal.admin.access")) {
    redirect("/payroll/admin");
  }

  redirect("/payroll/dash");
}

