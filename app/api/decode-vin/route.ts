import { NextResponse } from "next/server";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const vin = String(body?.vin ?? "").trim().toUpperCase();

    if (!VIN_RE.test(vin)) {
      return NextResponse.json(
        { error: "Enter a valid 17-character VIN. VINs do not use I, O, or Q." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json({ error: "VIN service is temporarily unavailable." }, { status: 502 });
    }

    const data: any = await response.json();
    const v = data?.Results?.[0];
    if (!v) {
      return NextResponse.json({ error: "No vehicle data was returned for that VIN." }, { status: 404 });
    }

    const errorCode = String(v.ErrorCode ?? "0");
    const seriousError = errorCode !== "0" && !errorCode.split(",").every((x: string) => ["0", "1", "3", "14"].includes(x.trim()));

    const engine = [v.DisplacementL ? `${v.DisplacementL}L` : "", v.EngineConfiguration, v.EngineCylinders ? `${v.EngineCylinders} cyl` : ""]
      .filter(Boolean)
      .join(" · ");

    const vehicle = {
      vin,
      year: v.ModelYear || "",
      make: v.Make || "",
      model: v.Model || "",
      trim: v.Trim || v.Series || "",
      bodyClass: v.BodyClass || "",
      engine,
      driveType: v.DriveType || "",
      fuelType: v.FuelTypePrimary || "",
      plantCountry: v.PlantCountry || "",
      manufacturer: v.Manufacturer || ""
    };

    if (seriousError || !vehicle.make || !vehicle.year) {
      return NextResponse.json({ error: v.ErrorText || "VIN could not be decoded." }, { status: 422 });
    }

    return NextResponse.json({ vehicle, source: "NHTSA vPIC", warning: errorCode !== "0" ? (v.ErrorText || "Some VIN details need confirmation.") : undefined });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "VIN lookup timed out. Try again."
      : "Could not decode the VIN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
