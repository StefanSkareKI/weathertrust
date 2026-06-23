import { NextResponse } from "next/server";
import { upsertObservation } from "@/lib/db";
import { fetchSMHIObservations } from "@/lib/sources/smhiObs";
import { computeAndStoreAccuracy } from "@/lib/accuracy";

export async function POST() {
  try {
    const observations = await fetchSMHIObservations();
    for (const obs of observations) {
      upsertObservation(obs);
    }

    const result = computeAndStoreAccuracy();

    return NextResponse.json({
      ok: true,
      observationsStored: observations.length,
      accuracyRowsComputed: result.computed,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
