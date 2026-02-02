import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yr = searchParams.get("yr");
  const mn = searchParams.get("mn");
  const dy = searchParams.get("dy");

  if (!yr || !mn || !dy) {
    return NextResponse.json(
      { error: "yr, mn, dy パラメータが必要です" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    pc: "28",
    hc: "2030",
    yr,
    mn,
    dy,
    rg: "day",
  });

  try {
    const res = await fetch(
      `https://api.tide736.net/get_tide.php?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "潮汐データの取得に失敗しました" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Tide API error:", error);
    return NextResponse.json(
      { error: "潮汐APIへの接続に失敗しました" },
      { status: 500 }
    );
  }
}
