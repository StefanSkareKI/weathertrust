import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "weathertrust.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS forecasts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT NOT NULL,
      collected_at TEXT NOT NULL,
      target_date  TEXT NOT NULL,
      horizon_days INTEGER NOT NULL,
      temp_max    REAL,
      temp_min    REAL,
      temp_mean   REAL,
      precip_mm   REAL,
      wind_ms     REAL,
      UNIQUE(source, collected_at, target_date)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL UNIQUE,
      temp_max     REAL,
      temp_min     REAL,
      temp_mean    REAL,
      precip_mm    REAL,
      wind_ms      REAL
    );

    CREATE TABLE IF NOT EXISTS accuracy (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      source       TEXT NOT NULL,
      horizon_days INTEGER NOT NULL,
      computed_at  TEXT NOT NULL,
      mae_temp     REAL,
      mae_precip   REAL,
      mae_wind     REAL,
      sample_count INTEGER,
      UNIQUE(source, horizon_days, computed_at)
    );
  `);
}

export type Forecast = {
  id?: number;
  source: string;
  collected_at: string;
  target_date: string;
  horizon_days: number;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precip_mm: number | null;
  wind_ms: number | null;
};

export type Observation = {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precip_mm: number | null;
  wind_ms: number | null;
};

export type Accuracy = {
  source: string;
  horizon_days: number;
  computed_at: string;
  mae_temp: number | null;
  mae_precip: number | null;
  mae_wind: number | null;
  sample_count: number;
};

export function insertForecasts(forecasts: Forecast[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO forecasts
      (source, collected_at, target_date, horizon_days, temp_max, temp_min, temp_mean, precip_mm, wind_ms)
    VALUES
      (@source, @collected_at, @target_date, @horizon_days, @temp_max, @temp_min, @temp_mean, @precip_mm, @wind_ms)
  `);
  db.exec("BEGIN");
  try {
    for (const row of forecasts) stmt.run(row as Record<string, string | number | null>);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function upsertObservation(obs: Observation) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO observations (date, temp_max, temp_min, temp_mean, precip_mm, wind_ms)
    VALUES (@date, @temp_max, @temp_min, @temp_mean, @precip_mm, @wind_ms)
  `).run(obs as Record<string, string | number | null>);
}

export function upsertAccuracy(acc: Accuracy) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO accuracy (source, horizon_days, computed_at, mae_temp, mae_precip, mae_wind, sample_count)
    VALUES (@source, @horizon_days, @computed_at, @mae_temp, @mae_precip, @mae_wind, @sample_count)
  `).run(acc as Record<string, string | number | null>);
}

export function getRecentForecasts(days = 14): Forecast[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM forecasts
    WHERE target_date >= date('now', '-${days} days')
    ORDER BY collected_at DESC, target_date ASC
  `).all() as Forecast[];
}

export function getObservations(days = 60): Observation[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM observations
    WHERE date >= date('now', '-${days} days')
    ORDER BY date DESC
  `).all() as Observation[];
}

export function getAccuracy(): Accuracy[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM accuracy
    ORDER BY computed_at DESC, source ASC, horizon_days ASC
  `).all() as Accuracy[];
}

export function getForecastsForAccuracy(): { source: string; target_date: string; horizon_days: number; temp_max: number | null; temp_min: number | null; precip_mm: number | null; wind_ms: number | null }[] {
  const db = getDb();
  return db.prepare(`
    SELECT f.source, f.target_date, f.horizon_days,
           f.temp_max, f.temp_min, f.precip_mm, f.wind_ms,
           o.temp_max AS obs_temp_max, o.temp_min AS obs_temp_min,
           o.precip_mm AS obs_precip, o.wind_ms AS obs_wind
    FROM forecasts f
    INNER JOIN observations o ON o.date = f.target_date
    ORDER BY f.source, f.horizon_days, f.target_date
  `).all() as never;
}
