import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/layout/AppShell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 온보딩 미완료 시 리다이렉트 (온보딩 페이지 자체는 제외)
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || headerList.get("x-invoke-path") || "";

  if (!pathname.includes("/onboarding")) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();

    // settings가 없거나 onboarding_completed가 false이면 온보딩으로
    if (!settings || !settings.onboarding_completed) {
      // accounts가 있는지로도 체크 (온보딩 완료 시 계정이 생성됨)
      const { count } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!count || count === 0) {
        redirect("/onboarding");
      }
    }
  }

  return <AppShell user={user}>{children}</AppShell>;
}
