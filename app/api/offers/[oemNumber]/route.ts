import {NextResponse} from "next/server";
import {parts} from "@/lib/parts";
import {getRetailerOffers} from "@/lib/retailer-offers";
import {getEbayOffers} from "@/lib/ebay-offers";
export const runtime="nodejs";
const known=new Set(parts.map(p=>p.oemNumber));
export async function GET(_request:Request,{params}:{params:Promise<{oemNumber:string}>}){
 const {oemNumber}=await params;
 if(!/^[0-9A-Z]{11}$/.test(oemNumber)||!known.has(oemNumber))return NextResponse.json({error:"Choose an E90 catalog OEM number."},{status:404});
 const live=await getEbayOffers(oemNumber);
 return NextResponse.json({oemNumber,offers:[...getRetailerOffers(oemNumber),...live.offers],ebayStatus:live.status},{headers:{"Cache-Control":"private, no-store"}});
}
