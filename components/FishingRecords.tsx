"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase, FishingRecord } from "@/lib/supabase";

export default function FishingRecords() {
  const [records, setRecords] = useState<FishingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(true);

  // Form state
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [time, setTime] = useState("");
  const [tideType, setTideType] = useState("");
  const [fishCount, setFishCount] = useState("");
  const [fishType, setFishType] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    const client = getSupabase();
    if (!client) { setSupabaseReady(false); setLoading(false); return; }
    try {
      const { data, error } = await client
        .from("fishing_records")
        .select("*")
        .order("date", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Supabase error:", error);
        if (error.message?.includes("Invalid API key") || error.message?.includes("Invalid URL")) {
          setSupabaseReady(false);
        }
        return;
      }
      setRecords(data || []);
    } catch {
      setSupabaseReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const client = getSupabase();
    if (!client) { setSubmitting(false); return; }
    const { error } = await client.from("fishing_records").insert({
      date,
      time: time || null,
      tide_type: tideType || null,
      fish_count: fishCount ? parseInt(fishCount, 10) : null,
      fish_type: fishType || null,
      memo: memo || null,
    });

    if (error) {
      alert("保存に失敗しました: " + error.message);
    } else {
      setShowForm(false);
      setTime("");
      setTideType("");
      setFishCount("");
      setFishType("");
      setMemo("");
      fetchRecords();
    }
    setSubmitting(false);
  };

  if (!supabaseReady) {
    return (
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">釣果記録</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Supabase未設定</p>
          <p>
            釣果記録機能を使用するには、環境変数にSupabaseの設定が必要です。
            <code className="bg-amber-100 px-1 rounded">.env.local</code> に{" "}
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> と{" "}
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            を設定してください。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">釣果記録</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? "閉じる" : "+ 記録する"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                日付 *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                時刻
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                潮回り
              </label>
              <select
                value={tideType}
                onChange={(e) => setTideType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">選択</option>
                <option value="大潮">大潮</option>
                <option value="中潮">中潮</option>
                <option value="小潮">小潮</option>
                <option value="長潮">長潮</option>
                <option value="若潮">若潮</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                釣果数
              </label>
              <input
                type="number"
                min="0"
                value={fishCount}
                onChange={(e) => setFishCount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="匹"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              魚種
            </label>
            <input
              type="text"
              value={fishType}
              onChange={(e) => setFishType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="例: メバル、アジ、タチウオ"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              メモ
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="ポイント、仕掛け、天候など"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存する"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">読み込み中...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          まだ釣果記録がありません
        </p>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="border border-slate-200 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-700">
                  {record.date}
                  {record.time && ` ${record.time}`}
                </span>
                {record.tide_type && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {record.tide_type}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-600">
                {record.fish_type && (
                  <span className="mr-3">{record.fish_type}</span>
                )}
                {record.fish_count != null && (
                  <span className="font-medium">{record.fish_count}匹</span>
                )}
              </div>
              {record.memo && (
                <p className="text-xs text-slate-500 mt-1">{record.memo}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
