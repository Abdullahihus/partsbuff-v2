import catalogJson from "../data/e90-parts.json";

export type Part = {
  id: string;
  name: string;
  category: string;
  location: string;
  description: string;
  aliases: string[];
  symptoms: string[];
  side?: "Driver" | "Passenger" | "Either";
  oemNumber: string;
  previousOemNumbers?: string[];
  fitmentNotes: string;
  verification: "verified-subset" | "option-dependent" | "lookup-required";
  sourceLabel: string;
  sourceUrl: string;
  sourceProductUrl?: string;
  sourceRestrictions?: string[];
  sourceCheckedOn?: string;
  vehicleLabel?: string;
  vehicleDetails?: string;
  catalogProfileId?: string;
};

export const supportedCatalogProfile = {
  id: "bmw-e90-328i-n51-usa-2011-11",
  label: "2011 BMW 328i Sedan (E90 LCI)",
  details: "USA · N51 · production 11/2011 · left-hand drive",
  targetPartCount: 300,
  note: "Original RealOEM references and additional dealer candidates for this E90. Confirm VIN, production date and equipment before ordering."
};

// Original RealOEM profile remains available alongside the expanded BMW catalog.
export const parts: Part[] = catalogJson as Part[];

export const catalogStats = {
  currentPartCount: parts.length,
  targetPartCount: supportedCatalogProfile.targetPartCount,
  remainingPartCount: Math.max(0, supportedCatalogProfile.targetPartCount - parts.length)
};
