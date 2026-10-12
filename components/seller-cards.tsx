import {ExternalLink,Package} from "lucide-react";
import type {SellerListing} from "@/lib/seller-listings";
export function SellerCards({listings}:{listings:SellerListing[]}){
 return <div className="seller-grid">{listings.map(p=><article className="seller-card" key={p.id}>
  {p.imageUrl&&<img className="seller-photo" src={p.imageUrl} alt={p.title}/>}
  <div className="seller-card-top"><Package size={24}/><span className="condition-pill">{p.condition}</span></div>
  <div className="eyebrow">SOLD BY {p.seller.toUpperCase()}</div><h3>{p.title}</h3>
  <code>{p.oemNumber}</code><p>{p.description}</p>
  <div className="seller-price">{"$"+p.price.toFixed(2)} <small>USD</small></div>
  <p className="subtle">{p.quantity} listed · {p.shippingNote}</p>
  <p className="seller-fitment">{p.fitmentNote}</p>
  <a className="primary-button" href={p.purchaseUrl} target="_blank" rel="noopener noreferrer">Buy from {p.seller}<ExternalLink size={16}/></a>
 </article>)}</div>;
}
