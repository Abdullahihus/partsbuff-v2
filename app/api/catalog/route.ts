import {NextResponse} from 'next/server';
import {getCatalogCandidates} from '@/lib/catalog-provider';
export async function POST(request:Request){
 try{const body:any=await request.json();const result=await getCatalogCandidates(body?.vehicle||{});return NextResponse.json(result,{status:result.supported?200:422});}
 catch{return NextResponse.json({error:'Could not load this vehicle catalog.'},{status:500});}
}
