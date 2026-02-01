export type TideEvent = {
  time: string;
  height: number;
  type: "high" | "low";
};

export type CurrentFlow = {
  direction: "南流（下げ潮）" | "北流（上げ潮）" | "転流";
  strength: "強" | "中" | "弱";
  description: string;
};

export function parseTideEvents(data: Record<string, unknown>): TideEvent[] {
  const events: TideEvent[] = [];

  // tide736.net returns high/low tide arrays
  const high = data.high as Array<{ time: string; cm: string }> | undefined;
  const low = data.low as Array<{ time: string; cm: string }> | undefined;

  if (high) {
    for (const h of high) {
      if (h.time && h.time !== "--:--") {
        events.push({
          time: h.time,
          height: parseInt(h.cm, 10),
          type: "high",
        });
      }
    }
  }

  if (low) {
    for (const l of low) {
      if (l.time && l.time !== "--:--") {
        events.push({
          time: l.time,
          height: parseInt(l.cm, 10),
          type: "low",
        });
      }
    }
  }

  events.sort((a, b) => a.time.localeCompare(b.time));
  return events;
}

export function estimateCurrentFlow(
  events: TideEvent[],
  currentHour: number
): CurrentFlow {
  if (events.length === 0) {
    return {
      direction: "転流",
      strength: "弱",
      description: "データなし",
    };
  }

  // Find the surrounding events
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:00`;
  let prevEvent: TideEvent | null = null;
  let nextEvent: TideEvent | null = null;

  for (const event of events) {
    if (event.time <= currentTimeStr) {
      prevEvent = event;
    }
    if (event.time > currentTimeStr && !nextEvent) {
      nextEvent = event;
    }
  }

  if (!prevEvent && nextEvent) {
    prevEvent = { ...events[events.length - 1], type: events[events.length - 1].type === "high" ? "low" : "high" };
  }
  if (prevEvent && !nextEvent) {
    nextEvent = { ...events[0], type: events[0].type === "high" ? "low" : "high" };
  }

  if (!prevEvent || !nextEvent) {
    return { direction: "転流", strength: "弱", description: "推定不可" };
  }

  // Near transition points (within 30 min), flow is weak/transitional
  const prevMinutes = timeToMinutes(prevEvent.time);
  const nextMinutes = timeToMinutes(nextEvent.time);
  const currentMinutes = currentHour * 60;
  const totalInterval = nextMinutes - prevMinutes;
  const elapsed = currentMinutes - prevMinutes;
  const progress = totalInterval > 0 ? elapsed / totalInterval : 0.5;

  // Determine direction: after high tide = 南流 (southward/ebb), after low tide = 北流 (northward/flood)
  const direction: CurrentFlow["direction"] =
    prevEvent.type === "high" ? "南流（下げ潮）" : "北流（上げ潮）";

  // Estimate strength based on progress through the cycle
  // Strongest at mid-cycle, weakest near transitions
  let strength: CurrentFlow["strength"];
  if (progress < 0.15 || progress > 0.85) {
    strength = "弱";
  } else if (progress < 0.35 || progress > 0.65) {
    strength = "中";
  } else {
    strength = "強";
  }

  const heightDiff = Math.abs(
    (prevEvent.height || 0) - (nextEvent.height || 0)
  );
  const description = `${prevEvent.type === "high" ? "満潮" : "干潮"}(${prevEvent.time}) → ${nextEvent.type === "high" ? "満潮" : "干潮"}(${nextEvent.time}) 潮位差: ${heightDiff}cm`;

  return { direction, strength, description };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
