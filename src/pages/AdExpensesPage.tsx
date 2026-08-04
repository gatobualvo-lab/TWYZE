import { useEffect, useMemo, useState } from "react";
import { addAdExpense, listRecentAdExpenses, type AdExpense } from "../features/ad-expenses/api";

const PLATFORMS = ["TikTok Ads","Facebook Ads","Instagram Ads","Google Ads","YouTube Ads","Other"] as const;
const TYPES = ["Boost","Leads","Conversion","Awareness","Other"] as const;

export default function AdExpensesPage() {

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number] | "">("");
  const [adType, setAdType] = useState<(typeof TYPES)[number] | "">("");
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind:"ok"|"err"; text:string } | null>(null);

  const [rows, setRows] = useState<AdExpense[]>([]);
  const totalKES = useMemo(() => rows.reduce((s, r) => s + Number(r.amount_kes || 0), 0), [rows]);
  const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 2 });

  const load = async () => {
    try { setRows(await listRecentAdExpenses(20)); }
    catch (e:any) { setMsg({ kind:"err", text:e.message || "Failed to load expenses." }); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true); setMsg(null);
    try {
      if (!platform) throw new Error("Select an ad platform.");
      if (!adType) throw new Error("Select an ad type.");
      if (!amount.trim()) throw new Error("Enter an amount.");
      if (!dateStr) throw new Error("Choose an expense date.");

      await addAdExpense({ adPlatform: platform, adType, amountKES: amount, dateString: dateStr, notes: notes || undefined });
      setMsg({ kind:"ok", text:"Ad expense recorded." });
      setPlatform(""); setAdType(""); setAmount(""); setDateStr(""); setNotes("");
      await load();
    } catch (e:any) {
      setMsg({ kind:"err", text:e.message || "Failed to record ad expense." });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <h1 className="text-xl font-semibold">Record Ad Expense</h1>

      {msg && (
        <div className={`rounded p-3 text-sm ${msg.kind==="ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-3 p-4 border rounded-lg">
        <label className="grid gap-1">
          <span className="text-sm">Ad Platform *</span>
          <select className="border rounded px-3 py-2" value={platform} onChange={(e)=>setPlatform(e.target.value as any)}>
            <option value="">Select platform</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Ad Type *</span>
          <select className="border rounded px-3 py-2" value={adType} onChange={(e)=>setAdType(e.target.value as any)}>
            <option value="">Select type</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Amount (KES) *</span>
          <input
            className="border rounded px-3 py-2"
            inputMode="decimal"
            placeholder="30000"
            value={amount}
            onChange={(e)=>setAmount(e.target.value)}
            onBlur={(e)=>{
              const n = Number(e.target.value.replace(/[^\d.]/g,""));
              if (Number.isFinite(n) && n > 0) setAmount(n.toFixed(2));
            }}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Expense Date *</span>
          <input className="border rounded px-3 py-2" type="date" value={dateStr} onChange={(e)=>setDateStr(e.target.value)} />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Notes (Optional)</span>
          <textarea className="border rounded px-3 py-2" rows={3} placeholder="Campaign details, target audience, performance notes…" value={notes} onChange={(e)=>setNotes(e.target.value)} />
        </label>

        <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 w-fit" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Record Expense"}
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Recent Expenses</h2>
        <div className="text-sm text-gray-600">Total: {fmt.format(totalKES)}</div>
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Platform / Type</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.occurred_on}</td>
                  <td className="p-2">{r.ad_platform} · {r.ad_type}</td>
                  <td className="p-2 text-right">{fmt.format(Number(r.amount_kes))}</td>
                  <td className="p-2">{r.notes ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="p-3 text-gray-500" colSpan={4}>No expenses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
