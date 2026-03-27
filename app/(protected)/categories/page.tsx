"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category } from "@/lib/accounting/types";

export default function CategoriesPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [accRes, catRes] = await Promise.all([
      supabase.from("accounts").select("*").in("type", ["expense", "income"]).eq("is_system", false).eq("is_active", true).order("code"),
      supabase.from("categories").select("*").eq("is_active", true).order("name"),
    ]);
    setAccounts((accRes.data as Account[]) || []);
    setCategories((catRes.data as Category[]) || []);
    setLoading(false);
  }

  async function addAccount() {
    if (!newAccountName) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = `5${Date.now().toString().slice(-4)}`;
    const { data } = await supabase
      .from("accounts")
      .insert({ user_id: user.id, code, name: newAccountName, type: "expense" })
      .select()
      .single();

    if (data) {
      setAccounts([...accounts, data as Account]);
      setNewAccountName("");
    }
  }

  async function addCategory() {
    if (!newCategoryName) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: newCategoryName })
      .select()
      .single();

    if (data) {
      setCategories([...categories, data as Category]);
      setNewCategoryName("");
    }
  }

  async function deleteAccount(id: string) {
    await supabase.from("accounts").update({ is_active: false }).eq("id", id);
    setAccounts(accounts.filter((a) => a.id !== id));
  }

  async function deleteCategory(id: string) {
    await supabase.from("categories").update({ is_active: false }).eq("id", id);
    setCategories(categories.filter((c) => c.id !== id));
  }

  const inputClass =
    "flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (loading) return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;

  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  const incomeAccounts = accounts.filter((a) => a.type === "income");

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        계정 및 카테고리 관리
      </h1>

      {/* 목적 계정 (비용) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          지출 목적 계정
        </h2>
        <div className="flex gap-2">
          <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="새 계정명 (예: 반려동물)" className={inputClass}
            onKeyDown={(e) => e.key === "Enter" && addAccount()} />
          <button onClick={addAccount} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors">추가</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {expenseAccounts.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
              {a.name}
              <button onClick={() => deleteAccount(a.id)} className="ml-1 text-gray-400 hover:text-red-500 text-xs">x</button>
            </span>
          ))}
        </div>
      </div>

      {/* 목적 계정 (수입) */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          수입 목적 계정
        </h2>
        <div className="flex flex-wrap gap-2">
          {incomeAccounts.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950 px-3 py-1 text-sm text-green-700 dark:text-green-300">
              {a.name}
              <button onClick={() => deleteAccount(a.id)} className="ml-1 text-gray-400 hover:text-red-500 text-xs">x</button>
            </span>
          ))}
        </div>
      </div>

      {/* 품목 카테고리 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          품목 카테고리
        </h2>
        <div className="flex gap-2">
          <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="새 카테고리 (예: 반려동물용품)" className={inputClass}
            onKeyDown={(e) => e.key === "Enter" && addCategory()} />
          <button onClick={addCategory} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors">추가</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950 px-3 py-1 text-sm text-purple-700 dark:text-purple-300">
              {c.name}
              <button onClick={() => deleteCategory(c.id)} className="ml-1 text-gray-400 hover:text-red-500 text-xs">x</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
