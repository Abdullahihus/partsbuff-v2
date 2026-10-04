import offerJson from "../data/retailer-offers.json";

export type RetailerOffer = {
  retailer: "CarParts.com" | "PartsGeek" | "RockAuto";
  price?: number;
  currency?: "USD";
  label?: string;
  availability?: string;
  url: string;
  checkedOn?: string;
  fitmentNote?: string;
  snapshot?: boolean;
};

type OfferMap = Record<string, RetailerOffer[]>;

const snapshots = offerJson as OfferMap;

const retailerDefaults: RetailerOffer[] = [
  {
    retailer: "CarParts.com",
    url: "https://www.carparts.com/",
    availability: "Search retailer",
  },
  {
    retailer: "PartsGeek",
    url: "https://www.partsgeek.com/",
    availability: "Search retailer",
  },
  {
    retailer: "RockAuto",
    url: "https://www.rockauto.com/",
    availability: "Search retailer",
  },
];

export function getRetailerOffers(oemNumber: string): RetailerOffer[] {
  const known = snapshots[oemNumber] ?? [];
  const byRetailer = new Map(known.map((offer) => [offer.retailer, { ...offer, snapshot: true }]));

  return retailerDefaults.map((fallback) => {
    const offer = byRetailer.get(fallback.retailer);
    return offer ?? fallback;
  });
}
