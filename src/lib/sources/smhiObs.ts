import { Observation } from "../db";
import { formatDate, addDays, today } from "../dateUtils";

const LAT = 59.3293;
const LON = 18.0686;

export async function fetchSMHIObservations(): Promise<Observation[]> {
  const endDate = formatDate(addDays(today(), -1));
  const startDate = formatDate(addDays(today(), -60));

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max` +
    `&timezone=Europe%2FStockholm`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo historical fetch failed: ${res.status}`);
  const json = await res.json();

  const dates: string[] = json.daily.time;
  const tMax: (number | null)[] = json.daily.temperature_2m_max;
  const tMin: (number | null)[] = json.daily.temperature_2m_min;
  const tMean: (number | null)[] = json.daily.temperature_2m_mean;
  const precip: (number | null)[] = json.daily.precipitation_sum;
  const wind: (number | null)[] = json.daily.wind_speed_10m_max;

  return dates.map((date, i) => ({
    date,
    temp_max: tMax[i],
    temp_min: tMin[i],
    temp_mean: tMean[i],
    precip_mm: precip[i],
    wind_ms: wind[i] != null ? wind[i]! / 3.6 : null,
  }));
}
