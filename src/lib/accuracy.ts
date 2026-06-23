import { getDb, upsertAccuracy, Accuracy } from "./db";

type JoinedRow = {
  source: string;
  target_date: string;
  horizon_days: number;
  temp_max: number | null;
  temp_min: number | null;
  precip_mm: number | null;
  wind_ms: number | null;
  obs_temp_max: number | null;
  obs_temp_min: number | null;
  obs_precip: number | null;
  obs_wind: number | null;
};

function mae(pairs: [number | null, number | null][]): number | null {
  const valid = pairs.filter(([a, b]) => a != null && b != null) as [number, number][];
  if (valid.length === 0) return null;
  return valid.reduce((sum, [a, b]) => sum + Math.abs(a - b), 0) / valid.length;
}

export function computeAndStoreAccuracy(): { computed: number } {
  const db = getDb();
  const rows = db.prepare(`
    SELECT f.source, f.target_date, f.horizon_days,
           f.temp_max, f.temp_min, f.precip_mm, f.wind_ms,
           o.temp_max AS obs_temp_max, o.temp_min AS obs_temp_min,
           o.precip_mm AS obs_precip, o.wind_ms AS obs_wind
    FROM forecasts f
    INNER JOIN observations o ON o.date = f.target_date
    WHERE f.target_date < date('now')
    ORDER BY f.source, f.horizon_days, f.target_date
  `).all() as JoinedRow[];

  const groups: Record<string, JoinedRow[]> = {};
  for (const row of rows) {
    const key = `${row.source}::${row.horizon_days}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  const computedAt = new Date().toISOString().slice(0, 10);
  let count = 0;

  for (const [key, group] of Object.entries(groups)) {
    const [source, horizonStr] = key.split("::");
    const horizon_days = parseInt(horizonStr, 10);

    const maeTemp = mae(group.map((r) => [
      r.temp_max != null && r.temp_min != null ? (r.temp_max + r.temp_min) / 2 : null,
      r.obs_temp_max != null && r.obs_temp_min != null ? (r.obs_temp_max + r.obs_temp_min) / 2 : null,
    ]));
    const maePrecip = mae(group.map((r) => [r.precip_mm, r.obs_precip]));
    const maeWind = mae(group.map((r) => [r.wind_ms, r.obs_wind]));

    const acc: Accuracy = {
      source,
      horizon_days,
      computed_at: computedAt,
      mae_temp: maeTemp,
      mae_precip: maePrecip,
      mae_wind: maeWind,
      sample_count: group.length,
    };
    upsertAccuracy(acc);
    count++;
  }

  return { computed: count };
}
