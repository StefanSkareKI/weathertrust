export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT ?? "3000";
  const base = `http://localhost:${port}`;

  async function runDailyJob() {
    console.log(`[weathertrust] Daily job starting at ${new Date().toISOString()}`);
    try {
      const collectRes = await fetch(`${base}/api/collect`, { method: "POST" });
      const collectJson = await collectRes.json();
      console.log("[weathertrust] collect:", JSON.stringify(collectJson.results));

      const analyzeRes = await fetch(`${base}/api/analyze`, { method: "POST" });
      const analyzeJson = await analyzeRes.json();
      console.log("[weathertrust] analyze:", JSON.stringify(analyzeJson));
    } catch (e) {
      console.error("[weathertrust] Daily job failed:", e);
    }
  }

  const intervalHours = Math.max(1, Number(process.env.POLL_INTERVAL_HOURS ?? 24));
  const intervalMs = intervalHours * 60 * 60 * 1000;
  console.log(`[weathertrust] Poll interval: every ${intervalHours}h`);
  setInterval(runDailyJob, intervalMs);

  // Run once 10s after startup if today has no data yet
  setTimeout(async () => {
    try {
      const res = await fetch(`${base}/api/data`);
      const json = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const hasToday = (json.forecasts as { collected_at: string }[] | undefined)?.some(
        (f) => f.collected_at === today
      );
      if (!hasToday) {
        console.log("[weathertrust] No data for today — running initial collection...");
        await runDailyJob();
      } else {
        console.log("[weathertrust] Today's data already present, skipping startup collection.");
      }
    } catch {
      // Server not ready yet, skip silently
    }
  }, 10_000);
}
