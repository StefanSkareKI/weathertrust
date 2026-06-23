import { NextResponse } from "next/server";
import { insertForecasts } from "@/lib/db";
import { fetchSMHIForecasts } from "@/lib/sources/smhi";
import { fetchYrnoForecasts } from "@/lib/sources/yrno";
import { fetchOpenMeteoForecasts, fetchIconForecasts } from "@/lib/sources/openmeteo";
import { fetchOWMForecasts } from "@/lib/sources/owm";

export async function POST() {
  const collectedAt = new Date().toISOString().slice(0, 10);
  const results: Record<string, string> = {};

  const sources = [
    { name: "smhi", fn: () => fetchSMHIForecasts(collectedAt) },
    { name: "yrno", fn: () => fetchYrnoForecasts(collectedAt) },
    { name: "openmeteo", fn: () => fetchOpenMeteoForecasts(collectedAt) },
    { name: "icon", fn: () => fetchIconForecasts(collectedAt) },
    ...(process.env.OWM_API_KEY
      ? [{ name: "owm", fn: () => fetchOWMForecasts(collectedAt) }]
      : []),
  ];

  for (const source of sources) {
    try {
      const forecasts = await source.fn();
      insertForecasts(forecasts);
      results[source.name] = `ok (${forecasts.length} days)`;
    } catch (e) {
      results[source.name] = `error: ${(e as Error).message}`;
    }
  }

  return NextResponse.json({ collectedAt, results });
}
