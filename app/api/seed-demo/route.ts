import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 현실적인 12개월치 데모 데이터 생성.
 * 30대 직장인 1인 가구 기준. 계절성/이벤트 반영.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  const { data: accounts } = await supabase
    .from("accounts").select("id, code, name, type").eq("user_id", userId);
  if (!accounts?.length) return NextResponse.json({ error: "계정과목이 없습니다." }, { status: 400 });

  const { data: pms } = await supabase
    .from("payment_methods").select("id, name, method_type, linked_account_id")
    .eq("user_id", userId).eq("is_active", true);
  if (!pms?.length) return NextResponse.json({ error: "결제 수단이 없습니다." }, { status: 400 });

  const { data: categories } = await supabase
    .from("categories").select("id, name").eq("user_id", userId);

  const find = (code: string) => accounts.find((a) => a.code === code)?.id;
  const findCat = (name: string) => categories?.find((c) => c.name === name)?.id;

  const acct = {
    cooking: find("5100"), eating: find("5200"), housing: find("5300"),
    transport: find("5400"), health: find("5500"), leisure: find("5600"),
    shopping: find("5700"), education: find("5800"), occasions: find("5900"),
    telecom: find("5950"), insurance: find("5960"), tax: find("5970"),
    salary: find("4100"), sideIncome: find("4200"),
  };

  const defaultAssetId = pms[0].linked_account_id;
  const creditPm = pms.find((p) => p.method_type === "credit_card");
  const creditId = creditPm?.linked_account_id;
  const payTo = creditId || defaultAssetId;

  // equity 계정
  let equityId = find("3000");
  if (!equityId) {
    const { data: eq } = await supabase.from("accounts")
      .insert({ user_id: userId, code: "3000", name: "기초순자산", type: "equity", is_system: true })
      .select("id").single();
    equityId = eq?.id;
  }
  if (!equityId) return NextResponse.json({ error: "equity 계정 생성 실패" }, { status: 500 });

  const today = new Date();

  const rpc = (date: string, desc: string, txType: string, postings: { account_id: string; category_id?: string; amount: number }[]) =>
    supabase.rpc("create_journal_entry", {
      p_user_id: userId, p_entry_date: date, p_effective_date: date,
      p_description: desc, p_source: "system", p_tx_type: txType, p_postings: postings,
    });

  // 자연스러운 변동을 위한 헬퍼
  const vary = (base: number, pct: number = 0.15) =>
    Math.round(base * (1 + (Math.random() * 2 - 1) * pct));

  // --- 개시 잔액 (12개월 전) ---
  const startMonth = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const startDate = startMonth.toISOString().split("T")[0];

  await rpc(startDate, "개시 잔액: 예금", "transfer", [
    { account_id: defaultAssetId, amount: 20000000 },
    { account_id: equityId, amount: -20000000 },
  ]);
  if (creditId) {
    await rpc(startDate, "개시 잔액: 카드 미결제", "transfer", [
      { account_id: equityId, amount: 650000 },
      { account_id: creditId, amount: -650000 },
    ]);
  }

  // --- 12개월 거래 데이터 ---
  for (let mo = -11; mo <= 0; mo++) {
    const m = new Date(today.getFullYear(), today.getMonth() + mo, 1);
    const month = m.getMonth(); // 0-indexed (0=1월)
    const ym = (d: number) => new Date(m.getFullYear(), m.getMonth(), d).toISOString().split("T")[0];

    // ===== 수입 =====
    // 급여 350만원 (매월 25일)
    if (acct.salary) {
      await rpc(ym(25), "급여", "income", [
        { account_id: defaultAssetId, amount: 3500000 },
        { account_id: acct.salary, amount: -3500000 },
      ]);
    }
    // 부수입 (격월, 20~40만원)
    if (acct.sideIncome && mo % 2 === 0) {
      const amt = vary(300000, 0.3);
      await rpc(ym(15), "프리랜서 수입", "income", [
        { account_id: defaultAssetId, amount: amt },
        { account_id: acct.sideIncome, amount: -amt },
      ]);
    }
    // 보너스 (1월, 7월)
    if (acct.salary && (month === 0 || month === 6)) {
      await rpc(ym(25), month === 0 ? "연초 성과급" : "하반기 성과급", "income", [
        { account_id: defaultAssetId, amount: month === 0 ? 2000000 : 1500000 },
        { account_id: acct.salary, amount: month === 0 ? -2000000 : -1500000 },
      ]);
    }

    // ===== 고정 지출 =====
    // 월세 70만원
    if (acct.housing) {
      await rpc(ym(1), "월세", "expense", [
        { account_id: acct.housing, category_id: findCat("공과금"), amount: 700000 },
        { account_id: payTo, amount: -700000 },
      ]);
      // 관리비 (여름/겨울 높음)
      const mgmt = (month >= 5 && month <= 7) || (month >= 11 || month <= 1) ? 150000 : 100000;
      await rpc(ym(5), "관리비", "expense", [
        { account_id: acct.housing, category_id: findCat("공과금"), amount: vary(mgmt, 0.1) },
        { account_id: payTo, amount: -vary(mgmt, 0.1) },
      ]);
    }
    // 통신 5.5만원
    if (acct.telecom) {
      await rpc(ym(10), "휴대폰 요금", "expense", [
        { account_id: acct.telecom, category_id: findCat("공과금"), amount: 55000 },
        { account_id: payTo, amount: -55000 },
      ]);
    }
    // 헬스장 7만원
    if (acct.health) {
      await rpc(ym(5), "헬스장 회비", "expense", [
        { account_id: acct.health, category_id: findCat("의료/약품"), amount: 70000 },
        { account_id: payTo, amount: -70000 },
      ]);
    }

    // ===== 변동 지출: 식료품 (주 4회 장보기) =====
    if (acct.cooking) {
      const baseGrocery = [58000, 45000, 67000, 52000];
      // 명절(1,9월) 식비 상승
      const seasonMult = (month === 0 || month === 8) ? 1.3 : 1.0;
      for (let w = 0; w < 4; w++) {
        const amt = vary(Math.round(baseGrocery[w] * seasonMult));
        await rpc(ym(2 + w * 7), "마트 장보기", "expense", [
          { account_id: acct.cooking, category_id: findCat("식료품"), amount: amt },
          { account_id: payTo, amount: -amt },
        ]);
      }
    }

    // ===== 변동 지출: 외식 =====
    if (acct.eating) {
      const mealCount = month === 11 ? 10 : (month >= 5 && month <= 8) ? 9 : 7; // 12월 연말 모임 많음
      const mealDescs = ["카페", "점심 외식", "저녁 외식", "배달 음식", "카페", "회식", "브런치", "술자리", "배달 음식", "카페"];
      const mealBases = [6500, 12000, 28000, 22000, 5800, 40000, 18000, 35000, 19000, 7000];
      for (let i = 0; i < mealCount; i++) {
        const d = 2 + Math.floor((28 / mealCount) * i);
        const amt = vary(mealBases[i % mealBases.length]);
        await rpc(ym(d), mealDescs[i % mealDescs.length], "expense", [
          { account_id: acct.eating, category_id: findCat("식료품"), amount: amt },
          { account_id: payTo, amount: -amt },
        ]);
      }
    }

    // ===== 교통 =====
    if (acct.transport) {
      await rpc(ym(1), "교통카드 충전", "expense", [
        { account_id: acct.transport, category_id: findCat("교통/주유"), amount: vary(60000, 0.1) },
        { account_id: payTo, amount: -vary(60000, 0.1) },
      ]);
      // 택시 (월 1~2회)
      if (Math.random() > 0.3) {
        await rpc(ym(vary(15, 0.5)), "택시", "expense", [
          { account_id: acct.transport, category_id: findCat("교통/주유"), amount: vary(15000, 0.3) },
          { account_id: payTo, amount: -vary(15000, 0.3) },
        ]);
      }
    }

    // ===== 여가 =====
    if (acct.leisure) {
      // 넷플릭스 (매월)
      await rpc(ym(8), "넷플릭스", "expense", [
        { account_id: acct.leisure, category_id: findCat("문화/여가"), amount: 17000 },
        { account_id: payTo, amount: -17000 },
      ]);
      // 영화/공연 (격월)
      if (mo % 2 === 0) {
        const amt = vary(15000, 0.4);
        await rpc(ym(14), "영화", "expense", [
          { account_id: acct.leisure, category_id: findCat("문화/여가"), amount: amt },
          { account_id: payTo, amount: -amt },
        ]);
      }
      // 여름 휴가 (7-8월)
      if (month === 7) {
        await rpc(ym(20), "여름 휴가 숙소", "expense", [
          { account_id: acct.leisure, category_id: findCat("문화/여가"), amount: 350000 },
          { account_id: payTo, amount: -350000 },
        ]);
        await rpc(ym(21), "여름 휴가 식비/교통", "expense", [
          { account_id: acct.leisure, category_id: findCat("문화/여가"), amount: 250000 },
          { account_id: payTo, amount: -250000 },
        ]);
      }
      // 연말 파티 (12월)
      if (month === 11) {
        await rpc(ym(24), "크리스마스 디너", "expense", [
          { account_id: acct.leisure, category_id: findCat("문화/여가"), amount: 120000 },
          { account_id: payTo, amount: -120000 },
        ]);
      }
    }

    // ===== 쇼핑 =====
    if (acct.shopping) {
      // 생활용품 (매월)
      await rpc(ym(12), "생활용품 (쿠팡)", "expense", [
        { account_id: acct.shopping, category_id: findCat("생활용품"), amount: vary(32000) },
        { account_id: payTo, amount: -vary(32000) },
      ]);
      // 의류 (분기별)
      if (month % 3 === 0) {
        const clothingAmt = vary(month === 9 ? 200000 : 100000, 0.3); // 가을 환절기 더 많음
        await rpc(ym(18), month === 9 ? "가을 코트" : "의류", "expense", [
          { account_id: acct.shopping, category_id: findCat("의류"), amount: clothingAmt },
          { account_id: payTo, amount: -clothingAmt },
        ]);
      }
      // 전자제품 (가끔, 이상치 테스트)
      if (month === 3) {
        await rpc(ym(10), "에어팟 맥스", "expense", [
          { account_id: acct.shopping, category_id: findCat("전자제품"), amount: 769000 },
          { account_id: payTo, amount: -769000 },
        ]);
      }
    }

    // ===== 보험 =====
    if (acct.insurance) {
      // 자동차보험 연납 (1월)
      if (month === 0) {
        await rpc(ym(15), "자동차보험 (연납)", "expense", [
          { account_id: acct.insurance, category_id: findCat("기타"), amount: 420000 },
          { account_id: payTo, amount: -420000 },
        ]);
      }
      // 실비보험 (매월)
      await rpc(ym(20), "실비보험", "expense", [
        { account_id: acct.insurance, category_id: findCat("기타"), amount: 35000 },
        { account_id: payTo, amount: -35000 },
      ]);
    }

    // ===== 세금 =====
    if (acct.tax) {
      // 주민세 (8월)
      if (month === 7) {
        await rpc(ym(16), "주민세", "expense", [
          { account_id: acct.tax, amount: 10000 },
          { account_id: payTo, amount: -10000 },
        ]);
      }
    }

    // ===== 경조사 (불규칙) =====
    if (acct.occasions) {
      if (month === 4) {
        await rpc(ym(22), "친구 결혼 축의금", "expense", [
          { account_id: acct.occasions, amount: 100000 },
          { account_id: payTo, amount: -100000 },
        ]);
      }
      if (month === 9) {
        await rpc(ym(8), "동료 결혼 축의금", "expense", [
          { account_id: acct.occasions, amount: 50000 },
          { account_id: payTo, amount: -50000 },
        ]);
        await rpc(ym(25), "조카 돌잔치", "expense", [
          { account_id: acct.occasions, amount: 100000 },
          { account_id: payTo, amount: -100000 },
        ]);
      }
      if (month === 2) {
        await rpc(ym(15), "지인 부의금", "expense", [
          { account_id: acct.occasions, amount: 50000 },
          { account_id: payTo, amount: -50000 },
        ]);
      }
    }

    // ===== 교육 =====
    if (acct.education) {
      // 온라인 강의 (분기별)
      if (month % 4 === 1) {
        await rpc(ym(3), "온라인 강의 (Udemy)", "expense", [
          { account_id: acct.education, category_id: findCat("교육/도서"), amount: vary(25000, 0.2) },
          { account_id: payTo, amount: -vary(25000, 0.2) },
        ]);
      }
      // 도서 (가끔)
      if (mo % 3 === 0) {
        await rpc(ym(20), "서적 구매", "expense", [
          { account_id: acct.education, category_id: findCat("교육/도서"), amount: vary(18000, 0.3) },
          { account_id: payTo, amount: -vary(18000, 0.3) },
        ]);
      }
    }

    // ===== 건강 (추가) =====
    if (acct.health) {
      // 병원 (분기별)
      if (month % 3 === 0) {
        await rpc(ym(22), "병원 진료", "expense", [
          { account_id: acct.health, category_id: findCat("의료/약품"), amount: vary(25000, 0.3) },
          { account_id: payTo, amount: -vary(25000, 0.3) },
        ]);
      }
      // 약국 (가끔)
      if (month === 1 || month === 11) {
        await rpc(ym(10), "약국 (감기약)", "expense", [
          { account_id: acct.health, category_id: findCat("의료/약품"), amount: vary(8000) },
          { account_id: payTo, amount: -vary(8000) },
        ]);
      }
    }

    // ===== 카드 대금 결제 (매월 15일) =====
    if (creditId && mo > -11) {
      const cardPayment = vary(850000, 0.2);
      await rpc(ym(15), "카드 대금 결제", "transfer", [
        { account_id: creditId, amount: cardPayment },
        { account_id: defaultAssetId, amount: -cardPayment },
      ]);
    }
  }

  return NextResponse.json({ success: true, message: "12개월치 데모 데이터가 생성되었습니다." });
}
