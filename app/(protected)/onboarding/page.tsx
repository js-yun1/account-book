"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";

type Step = 1 | 2 | 3 | 4 | 5;

interface PaymentMethodInput {
  name: string;
  method_type: string;
  balance: number; // 초기 잔액 (자산은 양수, 부채(카드 미결제)는 양수로 입력 후 내부에서 처리)
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: 소득/지출
  const [monthlyIncome, setMonthlyIncome] = useState(3000000);
  const [monthlyExpense, setMonthlyExpense] = useState(2000000);

  // Step 2: 결제 수단
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInput[]>([
    { name: "현금", method_type: "cash", balance: 0 },
  ]);
  const [newPmName, setNewPmName] = useState("");
  const [newPmType, setNewPmType] = useState("bank_account");

  // Step 4: AI API 키 (선택)
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai" | "">("");
  const [aiApiKey, setAiApiKey] = useState("");

  function addPaymentMethod() {
    if (!newPmName) return;
    setPaymentMethods([...paymentMethods, { name: newPmName, method_type: newPmType, balance: 0 }]);
    setNewPmName("");
  }

  function removePaymentMethod(index: number) {
    if (paymentMethods.length <= 1) return;
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  }

  function updateBalance(index: number, value: number) {
    setPaymentMethods(paymentMethods.map((pm, i) =>
      i === index ? { ...pm, balance: value } : pm
    ));
  }

  async function handleComplete() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 기본 계정과목 시드
    await supabase.rpc("seed_default_accounts", { p_user_id: user.id });

    // 2. 기초순자산(equity) 계정 생성 (개시 분개용)
    const { data: equityAccount } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        code: "3000",
        name: "기초순자산",
        type: "equity",
        is_system: true,
      })
      .select()
      .single();

    // 3. 결제 수단별 자산/부채 계정 생성 + payment_methods 등록 + 개시 분개
    for (const pm of paymentMethods) {
      const isCredit = pm.method_type === "credit_card";
      const accountType = isCredit ? "liability" : "asset";
      const subtype = isCredit ? null : "current";
      const code = isCredit ? `2${Date.now().toString().slice(-4)}` : `1${Date.now().toString().slice(-4)}`;

      const { data: account } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          code,
          name: pm.name,
          type: accountType,
          subtype,
          is_system: false,
        })
        .select()
        .single();

      if (account) {
        await supabase.from("payment_methods").insert({
          user_id: user.id,
          name: pm.name,
          method_type: pm.method_type,
          linked_account_id: account.id,
          is_default: pm === paymentMethods[0],
        });

        // 개시 분개: 초기 잔액이 있으면 기록
        if (pm.balance > 0 && equityAccount) {
          const today = new Date().toISOString().split("T")[0];
          if (isCredit) {
            // 부채: Dr. 기초순자산 / Cr. 부채계정
            await supabase.rpc("create_journal_entry", {
              p_user_id: user.id,
              p_entry_date: today,
              p_effective_date: today,
              p_description: `개시 잔액: ${pm.name} 미결제`,
              p_source: "system",
              p_tx_type: "transfer",
              p_postings: [
                { account_id: equityAccount.id, amount: pm.balance },
                { account_id: account.id, amount: -pm.balance },
              ],
            });
          } else {
            // 자산: Dr. 자산계정 / Cr. 기초순자산
            await supabase.rpc("create_journal_entry", {
              p_user_id: user.id,
              p_entry_date: today,
              p_effective_date: today,
              p_description: `개시 잔액: ${pm.name}`,
              p_source: "system",
              p_tx_type: "transfer",
              p_postings: [
                { account_id: account.id, amount: pm.balance },
                { account_id: equityAccount.id, amount: -pm.balance },
              ],
            });
          }
        }
      }

      // 코드 중복 방지를 위한 약간의 딜레이
      await new Promise((r) => setTimeout(r, 50));
    }

    // 4. 설정 업데이트
    const threshold = Math.round(monthlyExpense * 0.1);
    await supabase.from("user_settings").update({
      monthly_income: monthlyIncome,
      monthly_expense: monthlyExpense,
      materiality_threshold: threshold,
      ai_api_provider: aiProvider || null,
      ai_api_key_encrypted: aiApiKey || null,
      onboarding_completed: true,
    }).eq("user_id", user.id);

    router.push("/dashboard");
  }

  const totalSteps = 5;
  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const prevBtnClass = "flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
  const nextBtnClass = "flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors";

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">시작하기</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Step {step} / {totalSteps}</p>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />
          ))}
        </div>
      </div>

      {/* Step 1: 소득/지출 */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">월 소득/지출 범위</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            자산/비용 구분 기준액을 산정하는 데 사용됩니다. 대략적인 값이면 됩니다.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">월 소득 (원)</label>
            <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(parseInt(e.target.value) || 0)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">월 지출 (원)</label>
            <input type="number" value={monthlyExpense} onChange={(e) => setMonthlyExpense(parseInt(e.target.value) || 0)} className={inputClass} />
          </div>
          <button onClick={() => setStep(2)} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors">다음</button>
        </div>
      )}

      {/* Step 2: 결제 수단 */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">결제 수단 등록</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            사용하는 결제 수단을 등록하세요. 다음 단계에서 각 계정의 현재 잔액을 입력합니다.
          </p>

          <div className="space-y-2">
            {paymentMethods.map((pm, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{pm.name}</span>
                <span className="text-xs text-gray-500">{pm.method_type === "credit_card" ? "신용카드" : pm.method_type === "bank_account" ? "은행" : pm.method_type === "debit_card" ? "체크카드" : "현금"}</span>
                <button onClick={() => removePaymentMethod(i)} className="text-xs text-gray-400 hover:text-red-500" disabled={paymentMethods.length <= 1}>x</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input type="text" value={newPmName} onChange={(e) => setNewPmName(e.target.value)} placeholder="이름 (예: 국민은행)" className={inputClass + " flex-1"} />
            <select value={newPmType} onChange={(e) => setNewPmType(e.target.value)} className={inputClass + " w-32"}>
              <option value="bank_account">은행 예금</option>
              <option value="credit_card">신용카드</option>
              <option value="debit_card">체크카드</option>
              <option value="cash">현금</option>
            </select>
            <button onClick={addPaymentMethod} className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">추가</button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className={prevBtnClass}>이전</button>
            <button onClick={() => setStep(3)} className={nextBtnClass}>다음</button>
          </div>
        </div>
      )}

      {/* Step 3: 초기 잔액 입력 */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">초기 잔액 입력</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            각 계정의 현재 잔액을 입력하세요. 가계부 시작 시점의 자산과 부채를 정확히 설정해야 순자산과 보고서가 올바르게 동작합니다.
          </p>

          <div className="space-y-3">
            {paymentMethods.map((pm, i) => {
              const isCredit = pm.method_type === "credit_card";
              return (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{pm.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isCredit
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}>
                      {isCredit ? "부채 (미결제액)" : "자산 (잔액)"}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={pm.balance || ""}
                    onChange={(e) => updateBalance(i, parseInt(e.target.value) || 0)}
                    placeholder={isCredit ? "카드 미결제 금액 (원)" : "현재 잔액 (원)"}
                    className={inputClass}
                  />
                  {pm.balance > 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {isCredit ? `미결제: ${formatKRW(pm.balance)}` : `잔액: ${formatKRW(pm.balance)}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-500 dark:text-gray-400">
            0원이면 건너뛰어도 됩니다. 나중에 이체 거래로 잔액을 조정할 수 있습니다.
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className={prevBtnClass}>이전</button>
            <button onClick={() => setStep(4)} className={nextBtnClass}>다음</button>
          </div>
        </div>
      )}

      {/* Step 4: AI API 키 (선택) */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI 영수증 인식 (선택)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            영수증 사진을 AI로 자동 인식하려면 API 키가 필요합니다. 나중에 설정에서도 등록할 수 있습니다.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AI 제공자</label>
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as typeof aiProvider)} className={inputClass}>
              <option value="">사용 안 함</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT-4o)</option>
            </select>
          </div>

          {aiProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
              <input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} placeholder="sk-..." className={inputClass} />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className={prevBtnClass}>이전</button>
            <button onClick={() => setStep(5)} className={nextBtnClass}>다음</button>
          </div>
        </div>
      )}

      {/* Step 5: 확인 */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">준비 완료!</h2>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm">
            <p>월 소득: {monthlyIncome.toLocaleString()}원</p>
            <p>월 지출: {monthlyExpense.toLocaleString()}원</p>
            <p>자산/비용 기준액: {Math.round(monthlyExpense * 0.1).toLocaleString()}원</p>
            <p>결제 수단:</p>
            <div className="pl-2 space-y-1">
              {paymentMethods.map((pm, i) => (
                <p key={i} className="text-gray-600 dark:text-gray-400">
                  {pm.name}: {pm.method_type === "credit_card" ? `미결제 ${formatKRW(pm.balance)}` : `잔액 ${formatKRW(pm.balance)}`}
                </p>
              ))}
            </div>
            <p>AI 인식: {aiProvider || "사용 안 함"}</p>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            기본 계정과목(요리, 외식, 교통 등)이 자동으로 생성됩니다. 나중에 설정에서 변경할 수 있습니다.
          </p>

          <div className="flex gap-2">
            <button onClick={() => setStep(4)} className={prevBtnClass}>이전</button>
            <button onClick={handleComplete} disabled={loading} className={nextBtnClass + " disabled:opacity-50"}>
              {loading ? "설정 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
