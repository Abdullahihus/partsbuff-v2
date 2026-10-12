import type {RetailerOffer} from "./retailer-offers";
export type EbayResult={status:"available"|"not-configured"|"unavailable";offers:RetailerOffer[]};
let token:{value:string;expires:number}|undefined;
let tokenRequest:Promise<string>|undefined;
let blockedUntil=0;
const cache=new Map<string,{expires:number;result:EbayResult}>();
const pending=new Map<string,Promise<EbayResult>>();
const TIMEOUT=8000;
async function accessToken():Promise<string>{
 if(token&&token.expires>Date.now())return token.value;
 if(tokenRequest)return tokenRequest;
 tokenRequest=(async()=>{
  const response=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",
    Authorization:"Basic "+Buffer.from(process.env.EBAY_CLIENT_ID+":"+process.env.EBAY_CLIENT_SECRET).toString("base64")},
   body:new URLSearchParams({grant_type:"client_credentials",scope:"https://api.ebay.com/oauth/api_scope"}),
   cache:"no-store",signal:AbortSignal.timeout(TIMEOUT)
  });
  if(!response.ok)throw new Error("eBay authorization unavailable");
  const data=await response.json();
  if(typeof data.access_token!=="string"||!Number.isFinite(data.expires_in)||data.expires_in<120)throw new Error("Invalid eBay token response");
  token={value:data.access_token,expires:Date.now()+(data.expires_in-90)*1000};
  return token.value;
 })();
 try{return await tokenRequest;}finally{tokenRequest=undefined;}
}
export function parseEbayItems(data:unknown,oemNumber:string,checkedOn:string):RetailerOffer[]{
 if(!/^[0-9A-Z]{11}$/.test(oemNumber))return [];
 if(!data||typeof data!=="object")return [];
 const items=(data as {itemSummaries?:unknown}).itemSummaries;
 if(!Array.isArray(items))return [];
 const found:RetailerOffer[]=[];
 const seen=new Set<string>();
 const matchPattern=new RegExp("(^|[^A-Z0-9])"+oemNumber.split("").join("[\\s-]*")+"([^A-Z0-9]|$)","i");
 for(const item of items){
  if(!item||typeof item.title!=="string"||typeof item.itemId!=="string")continue;
  if(!matchPattern.test(item.title))continue;
  if(!Array.isArray(item.buyingOptions)||!item.buyingOptions.includes("FIXED_PRICE")||item.price?.currency!=="USD")continue;
  if(!["string","number"].includes(typeof item.price.value))continue;
  const price=Number(item.price.value);
  if(!Number.isFinite(price)||price<=0)continue;
  if(item.itemEndDate&&Date.parse(item.itemEndDate)<Date.now())continue;
  let url:URL;
  try{url=new URL(item.itemWebUrl);}catch{continue;}
  if(url.protocol!=="https:"||!["www.ebay.com","ebay.com"].includes(url.hostname)||!url.pathname.startsWith("/itm/")||url.username||url.password||url.port)continue;
  if(seen.has(item.itemId))continue;seen.add(item.itemId);
  const conditionLabel=typeof item.condition==="string"?item.condition.slice(0,100):"Not specified";
  const condition:RetailerOffer["condition"]=/reman|refurbished/i.test(conditionLabel)?"Remanufactured":/^new/i.test(conditionLabel)?"New":/used|pre-owned/i.test(conditionLabel)?"Used":"Not specified";
  const shipping=Array.isArray(item.shippingOptions)?item.shippingOptions.find((s:{shippingCost?:{currency?:string}})=>s.shippingCost?.currency==="USD")?.shippingCost:undefined;
  const shippingPrice=shipping?Number(shipping.value):undefined;
  found.push({retailer:"eBay",price,currency:"USD",url:url.href,label:item.title.slice(0,500),
   checkedOn,snapshot:false,condition,conditionLabel,itemId:item.itemId,
   seller:typeof item.seller?.username==="string"?item.seller.username.slice(0,100):undefined,
   shippingPrice:Number.isFinite(shippingPrice)&&shippingPrice!>=0?shippingPrice:undefined,
   availability:"Active listing when fetched",
   fitmentNote:"OEM number appears in the seller's title. Check authenticity, compatibility, condition, included quantity and seller details before buying."});
  if(found.length===5)break;
 }
 return found;
}
export async function getEbayOffers(oemNumber:string):Promise<EbayResult>{
 if(!process.env.EBAY_CLIENT_ID||!process.env.EBAY_CLIENT_SECRET)return {status:"not-configured",offers:[]};
 const cached=cache.get(oemNumber);
 if(cached&&cached.expires>Date.now())return cached.result;
 if(blockedUntil>Date.now())return {status:"unavailable",offers:[]};
 if(pending.has(oemNumber))return pending.get(oemNumber)!;
 const work=(async():Promise<EbayResult>=>{
  try{
   const auth=await accessToken();
   const url=new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
   url.search=new URLSearchParams({q:"BMW "+oemNumber,limit:"20",filter:"buyingOptions:{FIXED_PRICE},deliveryCountry:US"}).toString();
   const response=await fetch(url,{headers:{Authorization:"Bearer "+auth,"X-EBAY-C-MARKETPLACE-ID":"EBAY_US"},cache:"no-store",signal:AbortSignal.timeout(TIMEOUT)});
   if(!response.ok){
    if(response.status===401)token=undefined;
    throw new Error("eBay listing service unavailable");
   }
   const offers=parseEbayItems(await response.json(),oemNumber,new Date().toISOString());
   const result:EbayResult={status:"available",offers};
   cache.set(oemNumber,{expires:Date.now()+15*60*1000,result});
   if(cache.size>500)cache.delete(cache.keys().next().value!);
   return result;
  }catch{
   blockedUntil=Date.now()+5*60*1000;
   return {status:"unavailable",offers:[]};
  }
 })();
 pending.set(oemNumber,work);
 try{return await work;}finally{pending.delete(oemNumber);}
}
