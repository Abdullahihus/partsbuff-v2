"use client";
import {useEffect,useState} from "react";
import {ExternalLink,BarChart3,ShoppingBag} from "lucide-react";
import type {Part} from "@/lib/parts";
import {getRetailerOffers,isPricedOffer,type RetailerOffer} from "@/lib/retailer-offers";
import {getSellerListings} from "@/lib/seller-listings";
import {SellerCards} from "./seller-cards";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@/components/ui/table";
const money=(n:number)=>"$"+n.toFixed(2);
export function OfferChart({offers}:{offers:RetailerOffer[]}){
 const priced=offers.filter(isPricedOffer);
 if(!priced.length)return <div className="price-chart-empty"><BarChart3 size={28}/><p>No recorded price is available for this part in the selected condition.</p></div>;
 const rows=priced.map(o=>({label:o.retailer+(o.seller?" · "+o.seller:""),price:o.price!,note:(o.conditionLabel||o.condition||"Condition not specified")+" · "+(o.snapshot?"Snapshot":"eBay listing"),url:o.url}));
 const max=Math.max(...rows.map(o=>o.price));
 return <figure className="offer-chart"><figcaption><BarChart3 size={19}/><b>{rows.length===1?"Recorded price":"Listed price comparison"}</b><span>USD · advertised prices</span></figcaption>
  <div className="offer-bars">{rows.map((o,i)=><div className="offer-bar-row" key={o.url+i}>
   <div className="offer-bar-label"><a href={o.url} target="_blank" rel="noopener noreferrer">{o.label}</a><small>{o.note}</small></div>
   <div className="offer-bar-track" aria-hidden="true"><div className="offer-bar-fill" style={{width:(100*o.price/max)+"%"}}/></div>
   <strong>{money(o.price)}</strong>
  </div>)}</div>
  <p>Different brands, condition and pack quantities can change the value. Check shipping, tax and any core deposit with the seller. Each bar represents one priced seller listing.</p>
 </figure>;
}
export function Offers({part}:{part:Part}){
 const base=getRetailerOffers(part.oemNumber);
 const [loaded,setLoaded]=useState<{number:string;offers:RetailerOffer[];status:string}>({number:part.oemNumber,offers:base,status:"loading"});
 const [filter,setFilter]=useState("all");
 useEffect(()=>{
  const controller=new AbortController();setFilter("all");
  const initial=getRetailerOffers(part.oemNumber);setLoaded({number:part.oemNumber,offers:initial,status:"loading"});
  if(!part.oemNumber)return()=>controller.abort();
  fetch("/api/offers/"+encodeURIComponent(part.oemNumber),{signal:controller.signal}).then(async r=>{
   if(!r.ok)throw new Error("Listing service unavailable");
   const d=await r.json();
   if(!controller.signal.aborted&&d.oemNumber===part.oemNumber&&Array.isArray(d.offers))setLoaded({number:part.oemNumber,offers:d.offers,status:d.ebayStatus});
  }).catch(()=>{if(!controller.signal.aborted)setLoaded({number:part.oemNumber,offers:initial,status:"unavailable"});});
  return()=>controller.abort();
 },[part.oemNumber]);
 if(!part.oemNumber)return <div className="info-box">Identify the OEM number in the VIN-specific catalog before comparing retailer listings.</div>;
 const offers=(loaded.number===part.oemNumber?loaded.offers:base).filter(isPricedOffer);
 const visible=offers.filter(o=>filter==="all"||(o.condition||"Not specified")===filter);
 const priced=visible;
 const lowest=priced.length?Math.min(...priced.map(o=>o.price!)):null;
 const sellers=getSellerListings(part.oemNumber);
 return <section className="offer-section"><div className="section-heading"><div><div className="eyebrow">PRICES & SELLER LISTINGS</div><h2>Compare before you commit.</h2></div>{lowest!==null&&<span className="snapshot-tag">Lowest shown · {money(lowest)}</span>}</div>
  <div className="offer-context"><code>OEM {part.oemNumber}</code><label>Condition <select aria-label="Filter offer condition" value={filter} onChange={e=>setFilter(e.target.value)}>{["all","New","Used","Remanufactured","Not specified"].map(s=><option key={s} value={s}>{s==="all"?"All conditions":s}</option>)}</select></label></div>
  <p className="subtle offer-disclaimer">Recorded prices are dated snapshots. {offers.some(o=>o.itemId)?"eBay prices are fetched listings. ":""}Confirm shipping, tax, stock, quantity and exact fitment with each seller.</p>
  <OfferChart offers={visible}/>
  {visible.length>0&&<Table className="offer-table"><TableHeader><TableRow><TableHead>Seller</TableHead><TableHead>Listed price</TableHead><TableHead>Listing / captured</TableHead><TableHead><span className="sr-only">Visit seller</span></TableHead></TableRow></TableHeader><TableBody>{visible.map((o,i)=><TableRow key={o.itemId||o.retailer+o.url+i}>
   <TableCell><strong>{o.retailer}</strong>{o.seller&&<small>{o.seller}</small>}<small>{o.brand||""}</small>{o.price!=null&&<span className="condition-pill">{o.conditionLabel||o.condition||"Condition not specified"}</span>}</TableCell>
   <TableCell className="price-cell">{money(o.price)}<small>{o.shippingPrice!=null?"Shipping "+money(o.shippingPrice):"Shipping not quoted"}{o.coreCharge?"; "+(o.coreChargeIncluded?"includes core deposit ":"core deposit extra ")+money(o.coreCharge):""}</small>{o.packNote&&<small>{o.packNote}</small>}</TableCell>
   <TableCell><span>{o.label||"Priced listing"}</span><small>{o.checkedOn?(o.snapshot?"Snapshot ":"Fetched ")+o.checkedOn.replace("T"," ").slice(0,16):"Date not recorded"}</small><small>{o.availability}</small></TableCell>
   <TableCell><a className="retailer-link" href={o.url} target="_blank" rel="noopener noreferrer">View listing<ExternalLink size={14}/></a></TableCell>
  </TableRow>)}</TableBody></Table>}
  {offers.some(o=>o.itemId)&&<p className="offer-live-note">eBay seller results require their own compatibility checks.</p>}
  {visible.filter(o=>o.fitmentNote).map((o,i)=><p className="retailer-fitment" key={o.url+i}><b>{o.retailer}:</b> {o.fitmentNote}</p>)}
  {sellers.length>0&&<div className="part-seller-section"><h3><ShoppingBag size={20}/>Available through PartsBuff</h3><SellerCards listings={sellers}/></div>}
 </section>;
}
