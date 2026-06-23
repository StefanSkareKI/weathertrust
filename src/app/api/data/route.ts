import { NextResponse } from "next/server";
import { getAccuracy, getRecentForecasts, getObservations } from "@/lib/db";

export async function GET() {
  const accuracy = getAccuracy();
  const forecasts = getRecentForecasts(30);
  const observations = getObservations(30);
  return NextResponse.json({ accuracy, forecasts, observations });
}
