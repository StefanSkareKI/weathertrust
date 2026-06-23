import { Forecast } from "../db";
import { formatDate, addDays, today } from "../dateUtils";

const LAT = 59.3293;
const LON = 18.0686;

type OWMItem = {
  dt_txt: string;
  main: { temp: number; temp_max: number; temp_min: number };
  wind: { speed: number };
  rain?: { "3h"?: number };
};

export async function fetchOWMForecasts(collectedAt: string): Promise<Forecast[]> {
  const apiKey = process.env.OWM_API_KEY;
  if (!apiKey) throw new Error("OWM_API_KEY not set");

  const url =
    `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}` +
    `&appid=${apiKey}&units=metric`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OWM fetch failed: ${res.status}`);
  const json = await res.json();
  const items: OWMItem[] = json.list;

  const dailyData: Record<string, { temps: number[]; precips: number[]; winds: number[] }> = {};

  for (const item of items) {
    const date = item.dt_txt.slice(0, 10);
    if (!dailyData[date]) dailyData[date] = { temps: [], precips: [], winds: [] };
    dailyData[date].temps.push(item.main.temp);
    dailyData[date].winds.push(item.wind.speed);
    if (item.rain?.["3h"] != null) dailyData[date].precips.push(item.rain["3h"]);
  }

  const base = today();
  const forecasts: Forecast[] = [];

  for (let h = 1; h <= 5; h++) {
    const targetDate = formatDate(addDays(base, h));
    const d = dailyData[targetDate];
    if (!d || d.temps.length === 0) continue;
    const precipTotal = d.precips.reduce((a, b) => a + b, 0);
    forecasts.push({
      source: "owm",
      collected_at: collectedAt,
      target_date: targetDate,
      horizon_days: h,
      temp_max: Math.max(...d.temps),
      temp_min: Math.min(...d.temps),
      temp_mean: d.temps.reduce((a, b) => a + b, 0) / d.temps.length,
      precip_mm: precipTotal,
      wind_ms: d.winds.reduce((a, b) => a + b, 0) / d.winds.length,
    });
  }
  return forecasts;
}
