import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReceiptWithAI } from "@/lib/ai/receipt-parser";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 사용자 설정에서 AI API 키 가져오기
  const { data: settings } = await supabase
    .from("user_settings")
    .select("ai_api_provider, ai_api_key_encrypted")
    .eq("user_id", user.id)
    .single();

  if (!settings?.ai_api_provider || !settings?.ai_api_key_encrypted) {
    return NextResponse.json(
      { error: "AI API 키가 설정되지 않았습니다. 설정에서 등록해주세요." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { imageBase64, mediaType } = body;

    if (!imageBase64 || !mediaType) {
      return NextResponse.json(
        { error: "이미지 데이터가 필요합니다" },
        { status: 400 }
      );
    }

    const result = await parseReceiptWithAI(
      imageBase64,
      mediaType,
      settings.ai_api_key_encrypted, // TODO: 복호화 필요 (Supabase Vault 연동 시)
      settings.ai_api_provider as "anthropic" | "openai"
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "파싱 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
