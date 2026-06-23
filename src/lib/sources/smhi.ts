import { Forecast } from "../db";
import { formatDate, addDays, today } from "../dateUtils";

const LAT = 59.3293;
const LON = 18.0686;

type Snow1gEntry = {
  time: string;
  intervalParametersStartTime: string;
  data: Record<string, number>;
};

export async function fetchSMHIForecasts(collectedAt: string): Promise<Forecast[]> {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${LON}/lat/${LAT}/data.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`SMHI snow1g fetch failed: ${res.status}`);
  const json = await res.json();
  const timeSeries: Snow1gEntry[] = json.timeSeries;

  const dailyData: Record<string, { temps: number[]; precips: number[]; winds: number[] }> = {};

  for (const entry of timeSeries) {
    // Group by local date (CET/CEST = UTC+1/+2); use simple UTC date as approximation
    const date = entry.time.slice(0, 10);
    if (!dailyData[date]) dailyData[date] = { temps: [], precips: [], winds: [] };

    const t = entry.data["air_temperature"];
    const ws = entry.data["wind_speed"];
    const precip = entry.data["precipitation_amount_mean_deterministic"];

    // Interval duration in hours for correct precipitation accumulation
    const start = new Date(entry.intervalParametersStartTime).getTime();
    const end = new Date(entry.time).getTime();
    const intervalHours = (end - start) / 3_600_000;

    if (t != null) dailyData[date].temps.push(t);
    if (ws != null) dailyData[date].winds.push(ws);
    if (precip != null) dailyData[date].precips.push(precip * intervalHours);
  }

  const base = today();
  const forecasts: Forecast[] = [];

  for (let h = 1; h <= 5; h++) {
    const targetDate = formatDate(addDays(base, h));
    const d = dailyData[targetDate];
    if (!d || d.temps.length === 0) continue;
    forecasts.push({
      source: "smhi",
      collected_at: collectedAt,
      target_date: targetDate,
      horizon_days: h,
      temp_max: Math.max(...d.temps),
      temp_min: Math.min(...d.temps),
      temp_mean: d.temps.reduce((a, b) => a + b, 0) / d.temps.length,
      precip_mm: d.precips.reduce((a, b) => a + b, 0),
      wind_ms: d.winds.length ? d.winds.reduce((a, b) => a + b, 0) / d.winds.length : null,
    });
  }
  return forecasts;
}
