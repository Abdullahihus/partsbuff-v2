import {Catalog} from '@/components/partsbuff';
export default async function Page({searchParams}:{searchParams:Promise<{category?:string}>}){const p=await searchParams;return <Catalog initialCategory={p.category}/>}
