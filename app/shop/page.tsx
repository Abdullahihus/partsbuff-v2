import Link from "next/link";
import {ShoppingBag} from "lucide-react";
import {getSellerListings} from "@/lib/seller-listings";
import {SellerCards} from "@/components/seller-cards";
export default function Shop(){
 const listings=getSellerListings();
 return <><div className="page-heading"><div className="eyebrow">PARTSBUFF SHOP</div><h1>Parts with a second chapter.</h1><p>Browse parts offered by our sellers. Review the OEM number, condition and fitment before buying.</p></div>
 {listings.length?<SellerCards listings={listings}/>:<div className="empty-state shop-empty"><ShoppingBag size={44}/><h2>Our first listings are on the way.</h2><p>Parts from Ben and other sellers will appear here when they are available.</p><Link className="secondary-button" href="/catalog">Explore the parts catalog</Link></div>}
 </>;
}
