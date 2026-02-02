"use client";

import { useState, useEffect, useCallback } from "react";
import { parseTideEvents, estimateCurrentFlow, TideEvent, CurrentFlow } from "@/lib/tide-utils";
import FishingRecords from "@/components/FishingRecords";

function formatDate(date: Date) {
  return {
    yr: String(date.getFullYear()),
    mn: String(date.getMonth() + 1).padStart(2, "0"),
    dy: String(date.getDate()).padStart(2, "0"),
  };
}

function dateToInputValue(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tideEvents, setTideEvents] = useState<TideEvent[]>([]);
  const [currentFlow, setCurrentFlow] = useState<CurrentFlow | null>(null);
  const [tideData, setTideData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTide = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    const { yr, mn, dy } = formatDate(date);
    try {
      const res = await fetch(`/api/tide?yr=${yr}&mn=${mn}&dy=${dy}`);
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setTideData(data);
      const events = parseTideEvents(data);
      setTideEvents(events);
      const now = new Date();
      const hour =
        date.toDateString() === now.toDateString() ? now.getHours() : 12;
      setCurrentFlow(estimateCurrentFlow(events, hour));
    } catch {
      setError("潮汐データの取得に失敗しました。");
      setTideEvents([]);
      setCurrentFlow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTide(selectedDate);
  }, [selectedDate, fetchTide]);

  // Update current flow every minute for today
  useEffect(() => {
    if (selectedDate.toDateString() !== new Date().toDateString()) return;
    const interval = setInterval(() => {
      if (tideEvents.length > 0) {
        setCurrentFlow(estimateCurrentFlow(tideEvents, new Date().getHours()));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedDate, tideEvents]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value + "T00:00:00");
    if (!isNaN(d.getTime())) setSelectedDate(d);
  };

  const moveDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const hourlyData = tideData && (tideData as Record<string, unknown>).hourly
    ? (tideData as { hourly: Array<{ hour: string; cm: string }> }).hourly
    : null;

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-2xl font-bold text-blue-900">明石潮流ナビ</h1>
        <p className="text-sm text-slate-500 mt-1">
          明石港（兵庫県）の潮汐・潮流情報
        </p>
      </header>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => moveDate(-1)}
          className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition-colors text-sm font-medium"
          aria-label="前日"
        >
          &lt; 前日
        </button>
        <input
          type="date"
          value={dateToInputValue(selectedDate)}
          onChange={handleDateChange}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <button
          onClick={() => moveDate(1)}
          className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition-colors text-sm font-medium"
          aria-label="翌日"
        >
          翌日 &gt;
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 mt-3">潮汐データ取得中...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => fetchTide(selectedDate)}
            className="mt-2 text-sm text-red-600 underline"
          >
            再試行
          </button>
        </div>
      ) : (
        <>
          {/* Current Flow */}
          {currentFlow && (
            <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-4 sm:p-6 shadow-lg">
              <h2 className="text-sm font-medium opacity-80 mb-2">
                {selectedDate.toDateString() === new Date().toDateString()
                  ? "現在の推定潮流"
                  : "12時頃の推定潮流"}
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-4xl">
                  {currentFlow.direction === "南流（下げ潮）"
                    ? "↓"
                    : currentFlow.direction === "北流（上げ潮）"
                    ? "↑"
                    : "↔"}
                </div>
                <div>
                  <p className="text-xl font-bold">{currentFlow.direction}</p>
                  <p className="text-lg">
                    流速:{" "}
                    <span
                      className={
                        currentFlow.strength === "強"
                          ? "text-yellow-300 font-bold"
                          : currentFlow.strength === "中"
                          ? "text-blue-200"
                          : "text-blue-300"
                      }
                    >
                      {currentFlow.strength}
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-xs opacity-70 mt-3">
                {currentFlow.description}
              </p>
            </section>
          )}

          {/* Tide Events */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">
              満潮・干潮
            </h2>
            {tideEvents.length === 0 ? (
              <p className="text-sm text-slate-500">データがありません</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {tideEvents.map((event, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 text-center ${
                      event.type === "high"
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-orange-50 border border-orange-200"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 ${
                        event.type === "high"
                          ? "text-blue-600"
                          : "text-orange-600"
                      }`}
                    >
                      {event.type === "high" ? "満潮" : "干潮"}
                    </div>
                    <div className="text-xl font-bold text-slate-800">
                      {event.time}
                    </div>
                    <div className="text-sm text-slate-600">
                      {event.height}cm
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Hourly Tide */}
          {hourlyData && (
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-3">
                時間別潮位
              </h2>
              <div className="overflow-x-auto">
                <div className="flex gap-1 min-w-[600px]">
                  {hourlyData.map(
                    (h: { hour: string; cm: string }, i: number) => {
                      const height = parseInt(h.cm, 10);
                      const maxH = Math.max(
                        ...hourlyData.map(
                          (x: { cm: string }) => parseInt(x.cm, 10) || 0
                        )
                      );
                      const pct = maxH > 0 ? (height / maxH) * 100 : 0;
                      const isNow =
                        selectedDate.toDateString() ===
                          new Date().toDateString() &&
                        i === new Date().getHours();
                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center flex-1"
                        >
                          <span className="text-[10px] text-slate-500 mb-1">
                            {height}
                          </span>
                          <div className="w-full h-20 flex items-end">
                            <div
                              className={`w-full rounded-t-sm ${
                                isNow ? "bg-blue-600" : "bg-blue-300"
                              }`}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] mt-1 ${
                              isNow
                                ? "font-bold text-blue-600"
                                : "text-slate-500"
                            }`}
                          >
                            {i}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Tide Flow Timeline */}
          {tideEvents.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-3">
                潮流タイムライン
              </h2>
              <div className="space-y-2">
                {tideEvents.map((event, i) => {
                  const next = tideEvents[i + 1];
                  if (!next) return null;
                  const dir =
                    event.type === "high"
                      ? "南流（下げ潮）↓"
                      : "北流（上げ潮）↑";
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg p-2 text-sm ${
                        event.type === "high"
                          ? "bg-red-50"
                          : "bg-green-50"
                      }`}
                    >
                      <span className="font-mono text-slate-600 whitespace-nowrap">
                        {event.time} - {next.time}
                      </span>
                      <span
                        className={`font-semibold ${
                          event.type === "high"
                            ? "text-red-700"
                            : "text-green-700"
                        }`}
                      >
                        {dir}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Fishing Records */}
      <FishingRecords />

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-4">
        <p>潮汐データ: tide736.net</p>
        <p>潮流の向きと強さは推定値です</p>
      </footer>
    </main>
  );
}
