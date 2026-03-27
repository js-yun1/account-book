import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 현실적인 3개월치 데모 데이터 생성.
 * 30대 직장인 1인 가구 기준.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  // 계정 조회
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("user_id", userId);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "계정과목이 없습니다. 온보딩을 먼저 완료하세요." }, { status: 400 });
  }

  const find = (code: string) => accounts.find((a) => a.code === code)?.id;

  // 결제 수단 계정 (사용자가 만든 자산/부채 계정)
  const { data: pms } = await supabase
    .from("payment_methods")
    .select("id, name, method_type, linked_account_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!pms || pms.length === 0) {
    return NextResponse.json({ error: "결제 수단이 없습니다." }, { status: 400 });
  }

  // 카테고리 조회
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId);

  const findCat = (name: string) => categories?.find((c) => c.name === name)?.id;

  // 기본 계정 ID
  const cooking = find("5100");      // 요리
  const eating = find("5200");       // 외식
  const housing = find("5300");      // 주거
  const transport = find("5400");    // 교통
  const health = find("5500");       // 건강
  const leisure = find("5600");      // 여가
  const shopping = find("5700");     // 쇼핑
  const telecom = find("5950");      // 통신
  const insurance = find("5960");    // 보험
  const salary = find("4100");       // 근로소득
  const sideIncome = find("4200");   // 부수입

  // 첫 번째 결제 수단을 기본으로 사용
  const defaultPm = pms[0];
  const defaultAssetId = defaultPm.linked_account_id;
  // 신용카드가 있으면 사용
  const creditPm = pms.find((p) => p.method_type === "credit_card");
  const creditId = creditPm?.linked_account_id;

  // equity 계정
  let equityId = find("3000");
  if (!equityId) {
    const { data: eq } = await supabase
      .from("accounts")
      .insert({ user_id: userId, code: "3000", name: "기초순자산", type: "equity", is_system: true })
      .select("id")
      .single();
    equityId = eq?.id;
  }

  if (!equityId) {
    return NextResponse.json({ error: "기초순자산 계정 생성 실패" }, { status: 500 });
  }

  const today = new Date();
  const rpc = (date: string, desc: string, txType: string, postings: { account_id: string; category_id?: string; amount: number }[]) =>
    supabase.rpc("create_journal_entry", {
      p_user_id: userId,
      p_entry_date: date,
      p_effective_date: date,
      p_description: desc,
      p_source: "system",
      p_tx_type: txType,
      p_postings: postings,
    });

  // --- 초기 자산 설정 (3개월 전 시작) ---
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const startDate = threeMonthsAgo.toISOString().split("T")[0];

  await rpc(startDate, "개시 잔액: 예금", "transfer", [
    { account_id: defaultAssetId, amount: 15000000 }, // 1,500만원
    { account_id: equityId, amount: -15000000 },
  ]);

  if (creditId) {
    await rpc(startDate, "개시 잔액: 카드 미결제", "transfer", [
      { account_id: equityId, amount: 800000 }, // 80만원 미결제
      { account_id: creditId, amount: -800000 },
    ]);
  }

  // --- 3개월간의 거래 데이터 ---
  for (let monthOffset = -2; monthOffset <= 0; monthOffset++) {
    const m = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const ym = (d: number) => {
      const dt = new Date(m.getFullYear(), m.getMonth(), d);
      return dt.toISOString().split("T")[0];
    };

    const payTo = creditId || defaultAssetId;

    // 급여 (매월 25일)
    if (salary) {
      await rpc(ym(25), "급여", "income", [
        { account_id: defaultAssetId, amount: 3500000 },
        { account_id: salary, amount: -3500000 },
      ]);
    }

    // 부수입 (매월 15일, 가끔)
    if (sideIncome && monthOffset !== -1) {
      await rpc(ym(15), "프리랜서 수입", "income", [
        { account_id: defaultAssetId, amount: 300000 },
        { account_id: sideIncome, amount: -300000 },
      ]);
    }

    // 월세 (매월 1일)
    if (housing) {
      await rpc(ym(1), "월세", "expense", [
        { account_id: housing, category_id: findCat("공과금"), amount: 700000 },
        { account_id: payTo, amount: -700000 },
      ]);
    }

    // 식료품 (매주 장보기, 4회)
    if (cooking) {
      const amounts = [65000, 48000, 72000, 55000];
      for (let w = 0; w < 4; w++) {
        await rpc(ym(3 + w * 7), `마트 장보기`, "expense", [
          { account_id: cooking, category_id: findCat("식료품"), amount: amounts[w] + (monthOffset * 2000) },
          { account_id: payTo, amount: -(amounts[w] + (monthOffset * 2000)) },
        ]);
      }
    }

    // 외식 (주 2회)
    if (eating) {
      const meals = [
        { d: 5, desc: "점심 회식", amt: 15000 },
        { d: 8, desc: "카페", amt: 6500 },
        { d: 12, desc: "저녁 외식", amt: 32000 },
        { d: 16, desc: "카페", amt: 5800 },
        { d: 19, desc: "배달 음식", amt: 23000 },
        { d: 22, desc: "점심 외식", amt: 12000 },
        { d: 26, desc: "저녁 회식", amt: 45000 },
        { d: 28, desc: "카페", amt: 7200 },
      ];
      for (const meal of meals) {
        await rpc(ym(meal.d), meal.desc, "expense", [
          { account_id: eating, category_id: findCat("식료품"), amount: meal.amt },
          { account_id: payTo, amount: -meal.amt },
        ]);
      }
    }

    // 교통 (매일 출퇴근 교통카드 + 가끔 택시)
    if (transport) {
      await rpc(ym(1), "교통카드 충전", "expense", [
        { account_id: transport, category_id: findCat("교통/주유"), amount: 60000 },
        { account_id: payTo, amount: -60000 },
      ]);
      if (monthOffset === 0) {
        await rpc(ym(20), "택시", "expense", [
          { account_id: transport, category_id: findCat("교통/주유"), amount: 18000 },
          { account_id: payTo, amount: -18000 },
        ]);
      }
    }

    // 통신 (매월 10일)
    if (telecom) {
      await rpc(ym(10), "휴대폰 요금", "expense", [
        { account_id: telecom, category_id: findCat("공과금"), amount: 55000 },
        { account_id: payTo, amount: -55000 },
      ]);
    }

    // 건강 (매월 헬스장)
    if (health) {
      await rpc(ym(5), "헬스장 회비", "expense", [
        { account_id: health, category_id: findCat("의료/약품"), amount: 70000 },
        { account_id: payTo, amount: -70000 },
      ]);
    }

    // 여가 (가끔)
    if (leisure) {
      if (monthOffset === -2) {
        await rpc(ym(14), "영화", "expense", [
          { account_id: leisure, category_id: findCat("문화/여가"), amount: 15000 },
          { account_id: payTo, amount: -15000 },
        ]);
      }
      if (monthOffset === -1) {
        await rpc(ym(20), "넷플릭스", "expense", [
          { account_id: leisure, category_id: findCat("문화/여가"), amount: 17000 },
          { account_id: payTo, amount: -17000 },
        ]);
      }
      if (monthOffset === 0) {
        await rpc(ym(8), "넷플릭스", "expense", [
          { account_id: leisure, category_id: findCat("문화/여가"), amount: 17000 },
          { account_id: payTo, amount: -17000 },
        ]);
        await rpc(ym(18), "콘서트 티켓", "expense", [
          { account_id: leisure, category_id: findCat("문화/여가"), amount: 88000 },
          { account_id: payTo, amount: -88000 },
        ]);
      }
    }

    // 쇼핑 (가끔)
    if (shopping) {
      if (monthOffset === -2) {
        await rpc(ym(10), "운동화", "expense", [
          { account_id: shopping, category_id: findCat("의류"), amount: 129000 },
          { account_id: payTo, amount: -129000 },
        ]);
      }
      if (monthOffset === 0) {
        await rpc(ym(12), "생활용품 (쿠팡)", "expense", [
          { account_id: shopping, category_id: findCat("생활용품"), amount: 35000 },
          { account_id: payTo, amount: -35000 },
        ]);
      }
    }

    // 보험 (분기별)
    if (insurance && monthOffset === -2) {
      await rpc(ym(15), "자동차보험 (연납)", "expense", [
        { account_id: insurance, category_id: findCat("기타"), amount: 420000 },
        { account_id: payTo, amount: -420000 },
      ]);
    }

    // 경조사 (불규칙)
    const occasions = find("5900");
    if (occasions && monthOffset === -1) {
      await rpc(ym(22), "친구 결혼 축의금", "expense", [
        { account_id: occasions, amount: 100000 },
        { account_id: payTo, amount: -100000 },
      ]);
    }

    // 카드 대금 결제 (매월 15일, 이전 달 사용분)
    if (creditId && monthOffset > -2) {
      await rpc(ym(15), "카드 대금 결제", "transfer", [
        { account_id: creditId, amount: 800000 },
        { account_id: defaultAssetId, amount: -800000 },
      ]);
    }
  }

  return NextResponse.json({ success: true, message: "3개월치 데모 데이터가 생성되었습니다." });
}
