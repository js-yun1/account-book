import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTransaction } from "@/lib/accounting/journal";
import type { TransactionInput } from "@/lib/accounting/types";

// POST: 새 거래 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: TransactionInput = await request.json();
    const journalId = await createTransaction(supabase, user.id, body);
    return NextResponse.json({ id: journalId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET: 거래 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const txType = searchParams.get("tx_type");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const search = searchParams.get("q");

  let query = supabase
    .from("journal_entries")
    .select(
      `
      *,
      postings (
        id,
        account_id,
        category_id,
        amount,
        accounts:account_id (id, name, type, code),
        categories:category_id (id, name)
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (txType) query = query.eq("tx_type", txType);
  if (startDate) query = query.gte("entry_date", startDate);
  if (endDate) query = query.lte("entry_date", endDate);
  if (search) query = query.ilike("description", `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count,
    page,
    limit,
  });
}
