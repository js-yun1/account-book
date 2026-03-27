import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 사용자의 모든 앱 데이터를 삭제하고 온보딩부터 다시 시작할 수 있게 함 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;

  // 순서 중요: FK 의존성 역순으로 삭제
  await supabase.from("provisions").delete().eq("user_id", uid);
  await supabase.from("recurring_rules").delete().eq("user_id", uid);
  await supabase.from("assets").delete().eq("user_id", uid);
  // postings는 journal_entries CASCADE로 삭제됨
  await supabase.from("journal_entries").delete().eq("user_id", uid);
  await supabase.from("payment_methods").delete().eq("user_id", uid);
  await supabase.from("categories").delete().eq("user_id", uid);
  await supabase.from("accounts").delete().eq("user_id", uid);
  await supabase.from("user_settings").delete().eq("user_id", uid);

  return NextResponse.json({ success: true });
}
