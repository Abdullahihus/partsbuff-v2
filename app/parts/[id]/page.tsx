import {PartDetail} from '@/components/partsbuff';
import {getPartById} from '@/lib/catalog-reader';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;const part=await getPartById(id);if(!part)notFound();return <PartDetail part={part}/>}
