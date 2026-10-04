import {parts, supportedCatalogProfile, type Part} from './parts';
import {bmwProfiles, type BMWProfile} from './catalog-index';
import {makeStarterParts} from './starter-parts';
const loaders:Record<string,()=>Promise<{default:Record<string,unknown>}>>={
 "2000":()=>import("../data/bmw-parts/2000.json"),
 "2001":()=>import("../data/bmw-parts/2001.json"),
 "2002":()=>import("../data/bmw-parts/2002.json"),
 "2003":()=>import("../data/bmw-parts/2003.json"),
 "2004":()=>import("../data/bmw-parts/2004.json"),
 "2005":()=>import("../data/bmw-parts/2005.json"),
 "2006":()=>import("../data/bmw-parts/2006.json"),
 "2007":()=>import("../data/bmw-parts/2007.json"),
 "2008":()=>import("../data/bmw-parts/2008.json"),
 "2009":()=>import("../data/bmw-parts/2009.json"),
 "2010":()=>import("../data/bmw-parts/2010.json"),
 "2011":()=>import("../data/bmw-parts/2011.json"),
 "2012":()=>import("../data/bmw-parts/2012.json"),
 "2013":()=>import("../data/bmw-parts/2013.json"),
 "2014":()=>import("../data/bmw-parts/2014.json"),
 "2015":()=>import("../data/bmw-parts/2015.json"),
 "2016":()=>import("../data/bmw-parts/2016.json"),
 "2017":()=>import("../data/bmw-parts/2017.json"),
 "2018":()=>import("../data/bmw-parts/2018.json"),
 "2019":()=>import("../data/bmw-parts/2019.json"),
 "2020":()=>import("../data/bmw-parts/2020.json"),
 "2021":()=>import("../data/bmw-parts/2021.json"),
 "2022":()=>import("../data/bmw-parts/2022.json"),
 "2023":()=>import("../data/bmw-parts/2023.json"),
 "2024":()=>import("../data/bmw-parts/2024.json"),
 "2025":()=>import("../data/bmw-parts/2025.json"),
 "2026":()=>import("../data/bmw-parts/2026.json"),
};
export async function readProfileParts(profile:BMWProfile):Promise<Part[]>{
 const data=(await loaders[profile.year]()).default;
 const imported=(data[profile.id]||[]) as Part[];
 const needed=Math.max(0,20-imported.length);
 // Fill unfinished catalogs with clearly marked starter references, never guessed OEM numbers.
 const starters=makeStarterParts(profile).filter(p=>!imported.some(i=>i.name.toLowerCase()===p.name.toLowerCase())).slice(0,needed);
 return [...imported,...starters];
}
export async function getPartById(id:string):Promise<Part|undefined>{
 const legacy=parts.find(p=>p.id===id);if(legacy)return legacy;
 const profile=bmwProfiles.find(p=>id.startsWith(p.id+'-')&&(id.slice(p.id.length+1).startsWith('starter-')||/^[0-9A-Z]{11}$/.test(id.slice(p.id.length+1))));
 if(!profile)return undefined;
 // Saved starter references remain readable after their catalog gains OEM records.
 if(id.slice(profile.id.length+1).startsWith('starter-'))return makeStarterParts(profile).find(p=>p.id===id);
 return (await readProfileParts(profile)).find(p=>p.id===id);
}
export function partVehicleLabel(part:Part){return part.vehicleLabel||supportedCatalogProfile.label;}
