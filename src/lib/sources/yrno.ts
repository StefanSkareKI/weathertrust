import { Forecast } from "../db";
import { formatDate, addDays, today } from "../dateUtils";

const LAT = 59.3293;
const LON = 18.0686;

type YrTimestep = {
  time: string;
  data: {
    instant: { details: { air_temperature?: number; wind_speed?: number } };
    next_6_hours?: { details: { precipitation_amount?: number } };
    next_12_hours?: { details: { precipitation_amount?: number } };
  };
};

export async function fetchYrnoForecasts(collectedAt: string): Promise<Forecast[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "weathertrust/1.0 github.com/weathertrust" },
  });
  if (!res.ok) throw new Error(`yr.no forecast fetch failed: ${res.status}`);
  const json = await res.json();
  const timesteps: YrTimestep[] = json.properties.timeseries;

  const dailyData: Record<string, { temps: number[]; precips: number[]; winds: number[] }> = {};

  for (const ts of timesteps) {
    const date = ts.time.slice(0, 10);
    if (!dailyData[date]) dailyData[date] = { temps: [], precips: [], winds: [] };
    const t = ts.data.instant.details.air_temperature;
    const ws = ts.data.instant.details.wind_speed;
    const p6 = ts.data.next_6_hours?.details.precipitation_amount;
    if (t != null) dailyData[date].temps.push(t);
    if (ws != null) dailyData[date].winds.push(ws);
    if (p6 != null) dailyData[date].precips.push(p6);
  }

  const base = today();
  const forecasts: Forecast[] = [];

  for (let h = 1; h <= 5; h++) {
    const targetDate = formatDate(addDays(base, h));
    const d = dailyData[targetDate];
    if (!d || d.temps.length === 0) continue;
    forecasts.push({
      source: "yrno",
      collected_at: collectedAt,
      target_date: targetDate,
      horizon_days: h,
      temp_max: Math.max(...d.temps),
      temp_min: Math.min(...d.temps),
      temp_mean: d.temps.reduce((a, b) => a + b, 0) / d.temps.length,
      precip_mm: d.precips.length ? d.precips.reduce((a, b) => a + b, 0) : 0,
      wind_ms: d.winds.length ? d.winds.reduce((a, b) => a + b, 0) / d.winds.length : null,
    });
  }
  return forecasts;
}
