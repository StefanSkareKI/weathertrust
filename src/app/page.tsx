"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { RefreshCw, CloudDownload, BarChart2, Info, GitCompare } from "lucide-react";

type ConsensusRow = {
  source: string;
  temp_max: number | null;
  temp_min: number | null;
  temp_mean: number | null;
  precip_mm: number | null;
  wind_ms: number | null;
};

type ConsensusGroup = {
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

type Accuracy = {
  source: string;
  horizon_days: number;
  computed_at: string;
  mae_temp: number | null;
  mae_precip: number | null;
  mae_wind: number | null;
  sample_count: number;
};

type ApiData = {
  accuracy: Accuracy[];
  forecasts: unknown[];
  observations: unknown[];
};

const SOURCE_LABELS: Record<string, string> = {
  smhi: "SMHI",
  yrno: "yr.no",
  openmeteo: "Open-Meteo (ECMWF)",
  icon: "Open-Meteo (ICON)",
  owm: "OpenWeatherMap",
};

const SOURCE_COLORS: Record<string, string> = {
  smhi: "#3b82f6",
  yrno: "#10b981",
  openmeteo: "#f59e0b",
  icon: "#a855f7",
  owm: "#ef4444",
};

const HORIZONS = [1, 2, 3, 4, 5];

function buildHorizonChartData(accuracy: Accuracy[], metric: keyof Accuracy) {
  return HORIZONS.map((h) => {
    const row: Record<string, number | string> = { horizon: `Dag +${h}` };
    for (const [key] of Object.entries(SOURCE_LABELS)) {
      const match = accuracy.find((a) => a.source === key && a.horizon_days === h);
      if (match && match[metric] != null) {
        row[key] = parseFloat((match[metric] as number).toFixed(2));
      }
    }
    return row;
  });
}

function getLatestAccuracy(accuracy: Accuracy[]): Accuracy[] {
  const seen = new Set<string>();
  const result: Accuracy[] = [];
  const sorted = [...accuracy].sort((a, b) => b.computed_at.localeCompare(a.computed_at));
  for (const row of sorted) {
    const key = `${row.source}::${row.horizon_days}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }
  return result;
}

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectStatus, setCollectStatus] = useState<string | null>(null);
  const [analyzeStatus, setAnalyzeStatus] = useState<string | null>(null);
  const [metric, setMetric] = useState<"mae_temp" | "mae_precip" | "mae_wind">("mae_precip");
  const [tab, setTab] = useState<"accuracy" | "consensus">("accuracy");
  const [consensus, setConsensus] = useState<ConsensusGroup[]>([]);
  const [consensusHorizon, setConsensusHorizon] = useState(1);
  const [consensusMetric, setConsensusMetric] = useState<"temp_mean" | "temp_max" | "precip_mm" | "wind_ms">("precip_mm");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dataRes, consRes] = await Promise.all([
        fetch("/api/data"),
        fetch("/api/consensus"),
      ]);
      setData(await dataRes.json());
      setConsensus(await consRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCollect = async () => {
    setCollectStatus("Hämtar...");
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const json = await res.json();
      const summary = Object.entries(json.results as Record<string, string>)
        .map(([k, v]) => `${SOURCE_LABELS[k] ?? k}: ${v}`)
        .join(" · ");
      setCollectStatus(`Klart! ${summary}`);
      await loadData();
    } catch {
      setCollectStatus("Fel vid hämtning.");
    }
  };

  const handleAnalyze = async () => {
    setAnalyzeStatus("Analyserar...");
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setAnalyzeStatus(`Klart! ${json.observationsStored} obs, ${json.accuracyRowsComputed} noggrannhetsrader`);
        await loadData();
      } else {
        setAnalyzeStatus(`Fel: ${json.error}`);
      }
    } catch {
      setAnalyzeStatus("Fel vid analys.");
    }
  };

  const latestAccuracy = data ? getLatestAccuracy(data.accuracy) : [];
  const chartData = data ? buildHorizonChartData(latestAccuracy, metric) : [];
  const sources = Array.from(new Set(latestAccuracy.map((a) => a.source)));
  const totalSamples = latestAccuracy.find((a) => a.horizon_days === 1)?.sample_count ?? 0;

  const metricLabel = { mae_temp: "MAE Temperatur (°C)", mae_precip: "MAE Nederbörd (mm)", mae_wind: "MAE Vind (m/s)" }[metric];

  const consensusGroups = consensus
    .filter((g) => g.horizon_days === consensusHorizon)
    .sort((a, b) => b.target_date.localeCompare(a.target_date))
    .slice(0, 30);

  const metricKey = consensusMetric;
  const consensusChartData = consensusGroups.map((g) => {
    const row: Record<string, string | number> = { date: g.target_date.slice(5) };
    for (const r of g.rows) {
      const val = r[metricKey as keyof ConsensusRow];
      if (val != null) row[r.source] = parseFloat((val as number).toFixed(1));
    }
    return row;
  }).reverse();

  const consensusSources = Array.from(
    new Set(consensus.flatMap((g) => g.rows.map((r) => r.source)))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              WeatherTrust <span className="text-blue-400">Stockholm</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Oberoende noggrannhetsmätning av väderprognoser</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Info size={12} />
            <span>Plats: Stockholm (59.33°N, 18.07°E) · Observation: SMHI station 98210</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("accuracy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "accuracy" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <BarChart2 size={14} /> Noggrannhet
          </button>
          <button
            onClick={() => setTab("consensus")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "consensus" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            <GitCompare size={14} /> Källjämförelse
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {tab === "consensus" && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <GitCompare size={16} className="text-blue-400" />
                    Källjämförelse – vad spår källorna för samma dag?
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stor spridning = källorna är oense = osäker prognos. Tillgängligt från dag 1.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as const).map((h) => (
                      <button key={h} onClick={() => setConsensusHorizon(h)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${consensusHorizon === h ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                        +{h}d
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {(["temp_mean", "temp_max", "precip_mm", "wind_ms"] as const).map((m) => (
                      <button key={m} onClick={() => setConsensusMetric(m)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${consensusMetric === m ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                        {{ temp_mean: "Temp", temp_max: "MaxT", precip_mm: "Regn", wind_ms: "Vind" }[m]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Laddar...</div>
              ) : consensusChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                  <p>Inga prognoser insamlade ännu.</p>
                  <p className="text-xs text-slate-600">Klicka &quot;Hämta prognoser nu&quot; på Noggrannhets-fliken.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={consensusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#e2e8f0" }}
                      itemStyle={{ color: "#cbd5e1" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                    {consensusSources.map((s) => (
                      <Line key={s} type="monotone" dataKey={s} name={SOURCE_LABELS[s] ?? s}
                        stroke={SOURCE_COLORS[s] ?? "#6366f1"} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                Spridning mellan källor (för dag +{consensusHorizon})
              </h3>
              {consensusGroups.length === 0 ? (
                <p className="text-xs text-slate-500">Inga data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-700">
                        <th className="pb-2 pr-4">Datum</th>
                        {consensusSources.map((s) => (
                          <th key={s} className="pb-2 pr-4" style={{ color: SOURCE_COLORS[s] }}>
                            {SOURCE_LABELS[s] ?? s}
                          </th>
                        ))}
                        <th className="pb-2 pr-4 text-yellow-500">Spridning (°C / mm / m/s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consensusGroups.map((g) => {
                        const spreadVal = consensusMetric === "precip_mm" ? g.spread.precip_range
                          : consensusMetric === "wind_ms" ? g.spread.wind_range
                          : consensusMetric === "temp_max" ? g.spread.temp_max_range
                          : g.spread.temp_mean_range;
                        return (
                          <tr key={g.target_date} className="border-b border-slate-800 hover:bg-slate-700/20">
                            <td className="py-1.5 pr-4 text-slate-300">{g.target_date}</td>
                            {consensusSources.map((s) => {
                              const row = g.rows.find((r) => r.source === s);
                              const val = row ? row[consensusMetric as keyof ConsensusRow] : null;
                              return (
                                <td key={s} className="py-1.5 pr-4 text-slate-200">
                                  {val != null ? (val as number).toFixed(1) : "—"}
                                </td>
                              );
                            })}
                            <td className={`py-1.5 pr-4 font-medium ${spreadVal != null && spreadVal > 2 ? "text-orange-400" : "text-slate-400"}`}>
                              {spreadVal != null ? spreadVal.toFixed(1) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "accuracy" && <><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Antal dagar med data"
            value={String(totalSamples)}
            sub="Prognoser matchade mot observationer"
          />
          <StatCard
            title="Aktiva källor"
            value={String(sources.length || "—")}
            sub={sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ") || "Inga data ännu"}
          />
          <StatCard
            title="Bäst dag +1"
            value={(() => {
              const day1 = latestAccuracy.filter((a) => a.horizon_days === 1 && a.mae_temp != null);
              if (!day1.length) return "—";
              const best = day1.reduce((a, b) => (a.mae_temp! < b.mae_temp! ? a : b));
              return SOURCE_LABELS[best.source] ?? best.source;
            })()}
            sub="Lägst MAE för temperatur, dag +1"
          />
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart2 size={16} className="text-blue-400" />
                Noggrannhet per prognoshorisont
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Lägre MAE = mer noggrann</p>
            </div>
            <div className="flex gap-2">
              {(["mae_temp", "mae_precip", "mae_wind"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    metric === m
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {{ mae_temp: "Temp", mae_precip: "Nederbörd", mae_wind: "Vind" }[m]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Laddar...</div>
          ) : chartData.length === 0 || chartData.every((d) => sources.every((s) => !(s in d))) ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <p>Inga data ännu.</p>
              <p className="text-xs text-slate-600">Klicka &quot;Hämta prognoser&quot; dagligen och &quot;Analysera&quot; när dagar har passerat.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="horizon" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} label={{ value: metricLabel, angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#cbd5e1" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                {sources.map((s) => (
                  <Bar key={s} dataKey={s} name={SOURCE_LABELS[s] ?? s} fill={SOURCE_COLORS[s] ?? "#6366f1"} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CloudDownload size={15} className="text-blue-400" />
              Steg 1 – Hämta prognoser
            </h3>
            <p className="text-xs text-slate-400">Sparar dag +1 till +5 från alla källor. Kör varje dag (eller schemalägg via cron).</p>
            <button
              onClick={handleCollect}
              disabled={collectStatus === "Hämtar..."}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {collectStatus === "Hämtar..." ? "Hämtar..." : "Hämta prognoser nu"}
            </button>
            {collectStatus && collectStatus !== "Hämtar..." && (
              <p className="text-xs text-slate-300 bg-slate-900 rounded-lg p-2 break-words">{collectStatus}</p>
            )}
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <RefreshCw size={15} className="text-green-400" />
              Steg 2 – Analysera noggrannhet
            </h3>
            <p className="text-xs text-slate-400">Hämtar SMHI-observationer för passerade dagar och beräknar MAE för varje källa och horisont.</p>
            <button
              onClick={handleAnalyze}
              disabled={analyzeStatus === "Analyserar..."}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            >
              {analyzeStatus === "Analyserar..." ? "Analyserar..." : "Analysera nu"}
            </button>
            {analyzeStatus && analyzeStatus !== "Analyserar..." && (
              <p className="text-xs text-slate-300 bg-slate-900 rounded-lg p-2 break-words">{analyzeStatus}</p>
            )}
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Detaljer – Senaste noggrannhet</h3>
          {latestAccuracy.length === 0 ? (
            <p className="text-xs text-slate-500">Inga beräknade värden ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">Källa</th>
                    <th className="pb-2 pr-4">Dag</th>
                    <th className="pb-2 pr-4">MAE Temp (°C)</th>
                    <th className="pb-2 pr-4">MAE Nederbörd (mm)</th>
                    <th className="pb-2 pr-4">MAE Vind (m/s)</th>
                    <th className="pb-2 pr-4">Antal obs</th>
                    <th className="pb-2">Beräknat</th>
                  </tr>
                </thead>
                <tbody>
                  {latestAccuracy
                    .sort((a, b) => a.horizon_days - b.horizon_days || a.source.localeCompare(b.source))
                    .map((row) => (
                      <tr key={`${row.source}-${row.horizon_days}`} className="border-b border-slate-800 hover:bg-slate-700/30 transition-colors">
                        <td className="py-1.5 pr-4 font-medium" style={{ color: SOURCE_COLORS[row.source] ?? "#94a3b8" }}>
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </td>
                        <td className="py-1.5 pr-4 text-slate-300">+{row.horizon_days}</td>
                        <td className="py-1.5 pr-4 text-slate-200">{row.mae_temp?.toFixed(2) ?? "—"}</td>
                        <td className="py-1.5 pr-4 text-slate-200">{row.mae_precip?.toFixed(2) ?? "—"}</td>
                        <td className="py-1.5 pr-4 text-slate-200">{row.mae_wind?.toFixed(2) ?? "—"}</td>
                        <td className="py-1.5 pr-4 text-slate-400">{row.sample_count}</td>
                        <td className="py-1.5 text-slate-500">{row.computed_at}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div></>}

        <footer className="text-center text-xs text-slate-600 pb-4">
          Data: SMHI (snow1g) · yr.no · Open-Meteo ECMWF · Open-Meteo ICON · OpenWeatherMap ·{" "}
          <span className="text-slate-500">Observationer: Open-Meteo ERA5 reanalys</span>
        </footer>
      </main>
    </div>
  );
}
