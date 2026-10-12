import offerJson from "../data/retailer-offers.json";
import {getSellerOffers} from "./seller-listings";

export type RetailerOffer = {
  retailer: string;
  price?: number;
  currency?: "USD";
  label?: string;
  availability?: string;
  url: string;
  checkedOn?: string;
  fitmentNote?: string;
  snapshot?: boolean;
  condition?: "New" | "Used" | "Remanufactured" | "Not specified";
  conditionLabel?: string;
  brand?: string;
  msrp?: number;
  coreCharge?: number;
  coreChargeIncluded?: boolean;
  shippingPrice?: number;
  packNote?: string;
  sourceUrl?: string;
  itemId?: string;
  seller?: string;
};

type OfferMap = Record<string, RetailerOffer[]>;

const snapshots = offerJson as OfferMap;
export function isPricedOffer(offer:RetailerOffer):offer is RetailerOffer & {price:number;currency:"USD"} {
  return typeof offer.price==="number"&&Number.isFinite(offer.price)&&offer.price>0&&offer.currency==="USD";
}

export function getRetailerOffers(oemNumber: string): RetailerOffer[] {
  if (!/^[0-9A-Z]{11}$/.test(oemNumber)) return [];
  const known = (snapshots[oemNumber] ?? []).filter(isPricedOffer).map(o => ({...o, snapshot: true}));
  return [...known,...getSellerOffers(oemNumber).filter(isPricedOffer)];
}
