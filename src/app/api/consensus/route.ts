import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export type ConsensusRow = {
  target_date: string;
  horizon_days: number;
  source: string;
  collected_at: string;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precip_mm: number | null;
  wind_ms: number | null;
};

export type ConsensusDateGroup = {
  target_date: string;
  horizon_days: number;
  rows: ConsensusRow[];
  spread: {
    temp_mean_range: number | null;
    temp_max_range: number | null;
    precip_range: number | null;
    wind_range: number | null;
  };
};

function range(vals: (number | null)[]): number | null {
  const clean = vals.filter((v): v is number => v != null);
  if (clean.length < 2) return null;
  return Math.max(...clean) - Math.min(...clean);
}

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT f1.source, f1.target_date, f1.horizon_days, f1.collected_at,
           f1.temp_max, f1.temp_min, f1.temp_mean, f1.precip_mm, f1.wind_ms
    FROM forecasts f1
    INNER JOIN (
      SELECT source, target_date, MAX(collected_at) AS max_collected
      FROM forecasts
      GROUP BY source, target_date
    ) latest ON f1.source = latest.source
              AND f1.target_date = latest.target_date
              AND f1.collected_at = latest.max_collected
    WHERE f1.target_date >= date('now', '-30 days')
    ORDER BY f1.target_date DESC, f1.horizon_days ASC, f1.source ASC
  `).all() as ConsensusRow[];

  const groups: Map<string, ConsensusDateGroup> = new Map();
  for (const row of rows) {
    const key = `${row.target_date}::${row.horizon_days}`;
    if (!groups.has(key)) {
      groups.set(key, {
        target_date: row.target_date,
        horizon_days: row.horizon_days,
        rows: [],
        spread: { temp_mean_range: null, temp_max_range: null, precip_range: null, wind_range: null },
      });
    }
    groups.get(key)!.rows.push(row);
  }

  for (const group of Array.from(groups.values())) {
    group.spread.temp_mean_range = range(group.rows.map((r: ConsensusRow) => r.temp_mean));
    group.spread.temp_max_range = range(group.rows.map((r: ConsensusRow) => r.temp_max));
    group.spread.precip_range = range(group.rows.map((r: ConsensusRow) => r.precip_mm));
    group.spread.wind_range = range(group.rows.map((r: ConsensusRow) => r.wind_ms));
  }

  return NextResponse.json(Array.from(groups.values()) as ConsensusDateGroup[]);
}
