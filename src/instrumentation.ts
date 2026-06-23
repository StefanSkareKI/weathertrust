function msUntilNextUtc(hour: number, minute = 0): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

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

  function scheduleDailyAt(hour: number, minute = 0) {
    const delay = msUntilNextUtc(hour, minute);
    const nextRun = new Date(Date.now() + delay).toISOString();
    console.log(`[weathertrust] Next run scheduled for ${nextRun}`);
    setTimeout(() => {
      runDailyJob().finally(() => scheduleDailyAt(hour, minute));
    }, delay);
  }

  // Schedule at 05:00 UTC every day (07:00 CEST / 06:00 CET)
  scheduleDailyAt(5, 0);

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
