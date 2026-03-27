"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import type { UserSettings } from "@/lib/accounting/types";

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from("user_settings").select("*").single();
    setSettings(data as UserSettings | null);
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

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  if (!settings) return <div className="p-8 text-center text-gray-400">설정을 찾을 수 없습니다</div>;

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>

      <div className="space-y-4">
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            예측 기간
          </label>
          <select
            value={settings.forecast_months}
            onChange={(e) => setSettings({ ...settings, forecast_months: parseInt(e.target.value) as 6 | 12 })}
            className={inputClass}
          >
            <option value={6}>6개월</option>
            <option value={12}>12개월</option>
          </select>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            AI 제공자
          </label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Key
            </label>
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
          <p className={`text-sm ${message.includes("실패") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
