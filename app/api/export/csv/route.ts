import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  let query = supabase
    .from("journal_entries")
    .select(`
      entry_date, description, tx_type, source,
      postings (
        amount,
        accounts:account_id (name, type),
        categories:category_id (name)
      )
    `)
    .eq("user_id", user.id)
    .order("entry_date", { ascending: true });

  if (startDate) query = query.gte("entry_date", startDate);
  if (endDate) query = query.lte("entry_date", endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // CSV 생성 (UTF-8 BOM for Excel)
  const BOM = "\uFEFF";
  const header = "날짜,설명,유형,계정,카테고리,차변,대변\n";
  let csv = BOM + header;

  for (const entry of (data || []) as unknown as {
    entry_date: string;
    description: string;
    tx_type: string;
    postings: {
      amount: number;
      accounts: { name: string; type: string } | null;
      categories: { name: string } | null;
    }[];
  }[]) {
    for (const posting of entry.postings) {
      const debit = posting.amount > 0 ? posting.amount : "";
      const credit = posting.amount < 0 ? Math.abs(posting.amount) : "";
      csv += `${entry.entry_date},"${entry.description}",${entry.tx_type},${posting.accounts?.name || ""},${posting.categories?.name || ""},${debit},${credit}\n`;
    }
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="account-book-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
