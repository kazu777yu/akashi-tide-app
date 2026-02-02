"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { parseTideEvents, estimateCurrentFlow, TideEvent, CurrentFlow } from "@/lib/tide-utils";

const AkashiStraitMap = dynamic(() => import("@/components/AkashiStraitMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[65vh] bg-slate-900">
      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

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

function flowToMapProps(flow: CurrentFlow) {
  const direction = flow.direction === "南流（下げ潮）"
    ? "south" as const
    : flow.direction === "北流（上げ潮）"
    ? "north" as const
    : "slack" as const;
  const strength = flow.strength === "強"
    ? "strong" as const
    : flow.strength === "中"
    ? "medium" as const
    : "weak" as const;
  return { direction, strength, directionLabel: flow.direction, strengthLabel: flow.strength };
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tideEvents, setTideEvents] = useState<TideEvent[]>([]);
  const [currentFlow, setCurrentFlow] = useState<CurrentFlow | null>(null);
  const [tideData, setTideData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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
      const hour = date.toDateString() === now.toDateString() ? now.getHours() : 12;
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

  const mapProps = currentFlow
    ? flowToMapProps(currentFlow)
    : { direction: "slack" as const, strength: "weak" as const, directionLabel: "転流", strengthLabel: "弱" };

  return (
    <main className="min-h-screen bg-slate-900">
      {/* Header bar */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            明石潮流ナビ
          </h1>
          <p className="text-[10px] sm:text-xs text-white/50">明石海峡リアルタイム潮流</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => moveDate(-1)}
            className="px-2 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm transition-colors"
          >
            ◀
          </button>
          <input
            type="date"
            value={dateToInputValue(selectedDate)}
            onChange={handleDateChange}
            className="bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-xs sm:text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
          />
          <button
            onClick={() => moveDate(1)}
            className="px-2 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm transition-colors"
          >
            ▶
          </button>
        </div>
      </header>

      {/* Map Section */}
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center h-[60vh] bg-slate-900">
            <div>
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-white/50 mt-4">潮汐データ取得中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[60vh] bg-slate-900">
            <div className="text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => fetchTide(selectedDate)}
                className="mt-3 text-sm text-blue-400 underline"
              >
                再試行
              </button>
            </div>
          </div>
        ) : (
          <AkashiStraitMap {...mapProps} />
        )}
      </div>

      {/* Info panels below map */}
      {!loading && !error && (
        <div className="px-4 pb-6 pt-4 space-y-4 max-w-2xl mx-auto">
          {/* Current flow description */}
          {currentFlow && (
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
              <p className="text-xs text-white/50 mb-1">
                {selectedDate.toDateString() === new Date().toDateString()
                  ? "現在の推定潮流"
                  : "12時頃の推定潮流"}
              </p>
              <p className="text-sm text-white/70">{currentFlow.description}</p>
            </div>
          )}

          {/* Tide events - compact */}
          {tideEvents.length > 0 && (
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
              <h2 className="text-sm font-semibold text-white/80 mb-3">満潮・干潮</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tideEvents.map((event, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2.5 text-center ${
                      event.type === "high"
                        ? "bg-blue-500/15 border border-blue-500/30"
                        : "bg-orange-500/15 border border-orange-500/30"
                    }`}
                  >
                    <div className={`text-[10px] font-semibold mb-0.5 ${
                      event.type === "high" ? "text-blue-400" : "text-orange-400"
                    }`}>
                      {event.type === "high" ? "満潮" : "干潮"}
                    </div>
                    <div className="text-lg font-bold text-white">{event.time}</div>
                    <div className="text-xs text-white/60">{event.height}cm</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tide Flow Timeline */}
          {tideEvents.length > 1 && (
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
              <h2 className="text-sm font-semibold text-white/80 mb-3">潮流タイムライン</h2>
              <div className="space-y-1.5">
                {tideEvents.map((event, i) => {
                  const next = tideEvents[i + 1];
                  if (!next) return null;
                  const isSouth = event.type === "high";
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        isSouth ? "bg-orange-500/10" : "bg-blue-500/10"
                      }`}
                    >
                      <span className="text-white/60 font-mono text-xs whitespace-nowrap">
                        {event.time} → {next.time}
                      </span>
                      <span className={`font-semibold text-xs ${
                        isSouth ? "text-orange-400" : "text-blue-400"
                      }`}>
                        {isSouth ? "↓ 南流（下げ潮）" : "↑ 北流（上げ潮）"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hourly chart - toggle */}
          {hourlyData && (
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
              <button
                onClick={() => setShowDetail(!showDetail)}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-sm font-semibold text-white/80">時間別潮位</h2>
                <span className="text-xs text-white/40">{showDetail ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showDetail && (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-0.5 min-w-[500px]">
                    {hourlyData.map((h: { hour: string; cm: string }, i: number) => {
                      const height = parseInt(h.cm, 10);
                      const maxH = Math.max(
                        ...hourlyData.map((x: { cm: string }) => parseInt(x.cm, 10) || 0)
                      );
                      const pct = maxH > 0 ? (height / maxH) * 100 : 0;
                      const isNow =
                        selectedDate.toDateString() === new Date().toDateString() &&
                        i === new Date().getHours();
                      return (
                        <div key={i} className="flex flex-col items-center flex-1">
                          <span className="text-[9px] text-white/40 mb-1">{height}</span>
                          <div className="w-full h-16 flex items-end">
                            <div
                              className={`w-full rounded-t-sm ${
                                isNow ? "bg-blue-400" : "bg-blue-500/40"
                              }`}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[9px] mt-1 ${
                            isNow ? "font-bold text-blue-400" : "text-white/40"
                          }`}>
                            {i}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <footer className="text-center text-[10px] text-white/30 pt-2 pb-4">
            <p>潮汐データ: tide736.net | 潮流の向きと強さは推定値です</p>
          </footer>
        </div>
      )}
    </main>
  );
}
