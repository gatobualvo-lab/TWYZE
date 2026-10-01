import { supabase } from "../../utils/supabase";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "../../utils/security";
import { enqueueWrite, isNetworkError } from "../../services/offline/offlineQueue";

export type AdExpense = {
  id: string;
  ad_platform: string;
  ad_type: string;
  amount_kes: number;
  occurred_on: string;
  notes: string | null;
  created_at: string;
};

const toISO = (d: string) => {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
};

export async function addAdExpense(input: {
  adPlatform: string;
  adType: string;
  amountKES: string | number;
  dateString: string;
  notes?: string;
  projectId?: string;
}): Promise<{ data: AdExpense | null; offline: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in to record an expense.");

  const amount = typeof input.amountKES === "string"
    ? Number(input.amountKES.replace(/[^\d.]/g, ""))
    : Number(input.amountKES);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number.");

  if (!(await checkRateLimit('ad_expense.create'))) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }

  const record = {
    id: crypto.randomUUID(),
    ad_platform: input.adPlatform,
    ad_type: input.adType || "Other",
    amount_kes: amount,
    occurred_on: toISO(input.dateString),
    notes: input.notes ?? null,
    project_id: input.projectId ?? null,
  };

  const { data, error } = await supabase
    .from("ad_expenses")
    .insert(record)
    .select()
    .single();

  if (error) {
    if (!isNetworkError(error)) throw new Error(error.message);
    enqueueWrite({
      id: record.id,
      kind: 'ad_expense',
      table: 'ad_expenses',
      payload: record,
      label: `${input.adPlatform} — KES ${amount}`,
    });
    return { data: null, offline: true };
  }
  return { data: data as AdExpense, offline: false };
}

export async function listRecentAdExpenses(limit = 20): Promise<AdExpense[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("ad_expenses")
    .select("id, ad_platform, ad_type, amount_kes, occurred_on, notes, created_at")
    .order("occurred_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdExpense[];
}
