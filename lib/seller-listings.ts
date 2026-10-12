import listingJson from "../data/seller-listings.json";
import {parts} from "./parts";
import type {RetailerOffer} from "./retailer-offers";
export type SellerListing={
 id:string; oemNumber:string; seller:string; title:string; description:string;
 price:number; currency:"USD"; condition:"New"|"Used"|"Remanufactured";
 quantity:number; status:"draft"|"active"|"sold"; purchaseUrl:string;
 shippingNote:string; fitmentNote:string; imageUrl?:string; updatedOn:string;
};
const known=new Set(parts.map(p=>p.oemNumber));
export function validPurchaseUrl(value:unknown):value is string{
 if(typeof value!=="string")return false;
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  return (["buy.stripe.com","checkout.stripe.com"].includes(u.hostname)&&u.pathname.length>1)
   ||(["www.ebay.com","ebay.com"].includes(u.hostname)&&u.pathname.startsWith("/itm/"));
 }catch{return false;}
}
export function isSellerListing(value:unknown):value is SellerListing{
 if(!value||typeof value!=="object")return false;
 const p=value as SellerListing;
 return /^[a-z0-9-]{1,80}$/.test(p.id||"")&&known.has(p.oemNumber)
  &&[p.seller,p.title,p.description,p.shippingNote,p.fitmentNote].every(s=>typeof s==="string"&&s.trim().length>0&&s.length<=2000)
  &&Number.isFinite(p.price)&&p.price>0&&p.currency==="USD"
  &&["New","Used","Remanufactured"].includes(p.condition)
  &&Number.isInteger(p.quantity)&&p.quantity>=0
  &&["draft","active","sold"].includes(p.status)&&validPurchaseUrl(p.purchaseUrl)
  &&(p.imageUrl===undefined||(typeof p.imageUrl==="string"&&/^\/uploads\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/.test(p.imageUrl)))
  &&/^\d{4}-\d{2}-\d{2}$/.test(p.updatedOn||"");
}
export function getSellerListings(oemNumber?:string):SellerListing[]{
 const rows=listingJson.listings as unknown[];
 return rows.filter(isSellerListing).filter(p=>p.status==="active"&&p.quantity>0&&(!oemNumber||p.oemNumber===oemNumber));
}
export function getSellerOffers(oemNumber:string):RetailerOffer[]{
 return getSellerListings(oemNumber).map(p=>({
  retailer:"PartsBuff",seller:p.seller,price:p.price,currency:"USD",condition:p.condition,
  label:p.title,url:p.purchaseUrl,checkedOn:p.updatedOn,snapshot:true,
  availability:"Seller-listed quantity: "+p.quantity+" · "+p.shippingNote,
  fitmentNote:p.fitmentNote
 }));
}
