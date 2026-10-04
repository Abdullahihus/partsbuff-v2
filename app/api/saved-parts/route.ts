import {NextResponse} from 'next/server';
import {getPartById} from '@/lib/catalog-reader';
export async function POST(request:Request){
 try{const body:any=await request.json();if(!Array.isArray(body.ids)||body.ids.length>200||body.ids.some((id:unknown)=>typeof id!=='string'||id.length>160))return NextResponse.json({error:'Provide up to 200 part identifiers.'},{status:400});
 const parts=(await Promise.all(body.ids.map(getPartById))).filter(Boolean);return NextResponse.json({parts});}
 catch{return NextResponse.json({error:'Could not load saved parts.'},{status:500});}
}
