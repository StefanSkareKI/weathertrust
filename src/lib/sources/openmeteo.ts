import { Forecast } from "../db";
import { formatDate, addDays, today } from "../dateUtils";

const LAT = 59.3293;
const LON = 18.0686;

async function fetchOpenMeteoModel(
  source: string,
  model: string,
  collectedAt: string
): Promise<Forecast[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&timezone=Europe%2FStockholm&forecast_days=6&models=${model}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo (${model}) fetch failed: ${res.status}`);
  const json = await res.json();

  const dates: string[] = json.daily.time;
  const tMax: number[] = json.daily.temperature_2m_max;
  const tMin: number[] = json.daily.temperature_2m_min;
  const precip: number[] = json.daily.precipitation_sum;
  const wind: number[] = json.daily.wind_speed_10m_max;

  const base = today();
  const forecasts: Forecast[] = [];

  for (let h = 1; h <= 5; h++) {
    const targetDate = formatDate(addDays(base, h));
    const idx = dates.indexOf(targetDate);
    if (idx === -1) continue;
    forecasts.push({
      source,
      collected_at: collectedAt,
      target_date: targetDate,
      horizon_days: h,
      temp_max: tMax[idx] ?? null,
      temp_min: tMin[idx] ?? null,
      temp_mean: tMax[idx] != null && tMin[idx] != null ? (tMax[idx] + tMin[idx]) / 2 : null,
      precip_mm: precip[idx] ?? null,
      wind_ms: wind[idx] != null ? wind[idx] / 3.6 : null,
    });
  }
  return forecasts;
}

export async function fetchOpenMeteoForecasts(collectedAt: string): Promise<Forecast[]> {
  return fetchOpenMeteoModel("openmeteo", "ecmwf_ifs025", collectedAt);
}

export async function fetchIconForecasts(collectedAt: string): Promise<Forecast[]> {
  return fetchOpenMeteoModel("icon", "icon_seamless", collectedAt);
}
