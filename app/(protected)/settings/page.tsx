"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import type { UserSettings, PaymentMethod, Account } from "@/lib/accounting/types";

interface PaymentMethodWithBalance extends PaymentMethod {
  currentBalance: number;
  newBalance: number;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 초기 잔액 섹션
  const [pms, setPms] = useState<PaymentMethodWithBalance[]>([]);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [settingsRes, pmRes] = await Promise.all([
      supabase.from("user_settings").select("*").single(),
      supabase.from("payment_methods").select("*, accounts:linked_account_id(id, name, type)").eq("is_active", true),
    ]);

    setSettings(settingsRes.data as UserSettings | null);

    // 각 결제 수단의 현재 잔액 조회
    const pmData = (pmRes.data || []) as (PaymentMethod & { accounts: Account })[];
    const withBalances = await Promise.all(
      pmData.map(async (pm) => {
        const { data: balance } = await supabase.rpc("get_account_balance", {
          p_account_id: pm.linked_account_id,
        });
        const bal = (balance as number) || 0;
        return {
          ...pm,
          currentBalance: pm.method_type === "credit_card" ? Math.abs(bal) : bal,
          newBalance: pm.method_type === "credit_card" ? Math.abs(bal) : bal,
        };
      })
    );

    setPms(withBalances);
    setLoading(false);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("user_settings")
      .update({
        materiality_threshold: settings.materiality_threshold,
        ai_api_provider: settings.ai_api_provider,
        ai_api_key_encrypted: settings.ai_api_key_encrypted,
        forecast_months: settings.forecast_months,
      })
      .eq("id", settings.id);

    setSaving(false);
    setMessage(error ? `저장 실패: ${error.message}` : "저장 완료");
  }

  async function handleSetBalances() {
    setBalanceSaving(true);
    setBalanceMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBalanceSaving(false); return; }

    // equity 계정 확인/생성
    let { data: equityAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("code", "3000")
      .single();

    if (!equityAccount) {
      const { data: created } = await supabase
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
      equityAccount = created;
    }

    if (!equityAccount) {
      setBalanceMessage("기초순자산 계정 생성 실패");
      setBalanceSaving(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    let updated = 0;

    for (const pm of pms) {
      const diff = pm.newBalance - pm.currentBalance;
      if (diff === 0) continue;

      const isCredit = pm.method_type === "credit_card";

      if (isCredit) {
        // 부채 증가: Dr. 기초순자산 / Cr. 부채계정
        // 부채 감소: Dr. 부채계정 / Cr. 기초순자산
        await supabase.rpc("create_journal_entry", {
          p_user_id: user.id,
          p_entry_date: today,
          p_effective_date: today,
          p_description: `잔액 조정: ${pm.name}`,
          p_source: "system",
          p_tx_type: "transfer",
          p_postings: diff > 0
            ? [
                { account_id: equityAccount.id, amount: diff },
                { account_id: pm.linked_account_id, amount: -diff },
              ]
            : [
                { account_id: pm.linked_account_id, amount: Math.abs(diff) },
                { account_id: equityAccount.id, amount: -Math.abs(diff) },
              ],
        });
      } else {
        // 자산 증가: Dr. 자산계정 / Cr. 기초순자산
        // 자산 감소: Dr. 기초순자산 / Cr. 자산계정
        await supabase.rpc("create_journal_entry", {
          p_user_id: user.id,
          p_entry_date: today,
          p_effective_date: today,
          p_description: `잔액 조정: ${pm.name}`,
          p_source: "system",
          p_tx_type: "transfer",
          p_postings: diff > 0
            ? [
                { account_id: pm.linked_account_id, amount: diff },
                { account_id: equityAccount.id, amount: -diff },
              ]
            : [
                { account_id: equityAccount.id, amount: Math.abs(diff) },
                { account_id: pm.linked_account_id, amount: -Math.abs(diff) },
              ],
        });
      }
      updated++;
    }

    setBalanceSaving(false);
    setBalanceMessage(updated > 0 ? `${updated}개 계정 잔액 조정 완료` : "변경된 잔액이 없습니다");

    // 잔액 새로고침
    await loadAll();
  }

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  if (!settings) return <div className="p-8 text-center text-gray-400">설정을 찾을 수 없습니다</div>;

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>

      {/* 기본 설정 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">일반</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            자산/비용 구분 기준액
          </label>
          <input
            type="number"
            value={settings.materiality_threshold}
            onChange={(e) => setSettings({ ...settings, materiality_threshold: parseInt(e.target.value) || 0 })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            이 금액 이상의 구매 시 자산 등록을 제안합니다. 현재: {formatKRW(settings.materiality_threshold)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">예측 기간</label>
          <select
            value={settings.forecast_months}
            onChange={(e) => setSettings({ ...settings, forecast_months: parseInt(e.target.value) as 6 | 12 })}
            className={inputClass}
          >
            <option value={6}>6개월</option>
            <option value={12}>12개월</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AI 제공자</label>
          <select
            value={settings.ai_api_provider || ""}
            onChange={(e) => setSettings({ ...settings, ai_api_provider: (e.target.value || null) as UserSettings["ai_api_provider"] })}
            className={inputClass}
          >
            <option value="">사용 안 함</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
          </select>
        </div>

        {settings.ai_api_provider && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
            <input
              type="password"
              value={settings.ai_api_key_encrypted || ""}
              onChange={(e) => setSettings({ ...settings, ai_api_key_encrypted: e.target.value || null })}
              placeholder="sk-..."
              className={inputClass}
            />
          </div>
        )}

        {message && (
          <p className={`text-sm ${message.includes("실패") ? "text-red-600" : "text-green-600"}`}>{message}</p>
        )}

        <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>

      {/* 잔액 설정 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">계정 잔액 설정</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          각 결제 수단의 실제 잔액을 입력하세요. 차이가 있으면 조정 분개가 자동 생성됩니다.
        </p>

        <div className="space-y-3">
          {pms.map((pm, i) => {
            const isCredit = pm.method_type === "credit_card";
            const changed = pm.newBalance !== pm.currentBalance;
            return (
              <div key={pm.id} className={`rounded-lg border p-3 ${changed ? "border-blue-400 dark:border-blue-600" : "border-gray-200 dark:border-gray-700"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{pm.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isCredit ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  }`}>
                    {isCredit ? "부채" : "자산"} · 현재 {formatKRW(pm.currentBalance)}
                  </span>
                </div>
                <input
                  type="number"
                  value={pm.newBalance || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPms(pms.map((p, j) => j === i ? { ...p, newBalance: val } : p));
                  }}
                  placeholder={isCredit ? "미결제 금액 (원)" : "잔액 (원)"}
                  className={inputClass}
                />
                {changed && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {pm.newBalance - pm.currentBalance > 0 ? "+" : ""}{formatKRW(pm.newBalance - pm.currentBalance)} 조정 예정
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {pms.length === 0 && (
          <p className="text-sm text-gray-400">등록된 결제 수단이 없습니다.</p>
        )}

        {balanceMessage && (
          <p className={`text-sm ${balanceMessage.includes("실패") ? "text-red-600" : "text-green-600"}`}>{balanceMessage}</p>
        )}

        {pms.some((pm) => pm.newBalance !== pm.currentBalance) && (
          <button onClick={handleSetBalances} disabled={balanceSaving} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {balanceSaving ? "조정 중..." : "잔액 조정"}
          </button>
        )}
      </div>
      {/* 데모 데이터 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">개발/테스트</h2>
        <DemoDataButton />
      </div>
    </div>
  );
}

function DemoDataButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSeed() {
    if (!confirm("3개월치 현실적인 데모 데이터를 생성합니다. 계속할까요?")) return;
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/seed-demo", { method: "POST" });
    const data = await res.json();

    setLoading(false);
    setResult(res.ok ? data.message : `실패: ${data.error}`);
  }

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        테스트용 데모 데이터를 생성합니다. 30대 직장인 1인 가구 기준 3개월치 수입/지출.
      </p>
      <button
        onClick={handleSeed}
        disabled={loading}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "생성 중... (약 10초)" : "데모 데이터 생성"}
      </button>
      {result && (
        <p className={`mt-2 text-sm ${result.includes("실패") ? "text-red-600" : "text-green-600"}`}>{result}</p>
      )}
    </div>
  );
}
