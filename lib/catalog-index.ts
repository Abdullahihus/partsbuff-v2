import index from '@/data/bmw-catalog-index.json';
import {supportedCatalogProfile} from './parts';
export type BMWProfile = (typeof index.profiles)[number];
export const bmwProfiles = index.profiles;
export const catalogSummary = index.summary;
export function findBMWProfile(year?:string,model?:string) {
 if(typeof model!=='string')return undefined;
 return bmwProfiles.find(p=>p.year===String(year)&&p.model.toLowerCase()===model.toLowerCase());
}
export function profileLabel(profile:BMWProfile){return `${profile.year} BMW ${profile.model}`;}
export function catalogReference(vehicle:{year?:string;model?:string;catalogProfileId?:string}|null){
 if(vehicle?.catalogProfileId===supportedCatalogProfile.id)return supportedCatalogProfile.details;
 const p=findBMWProfile(vehicle?.year,vehicle?.model);
 return p?(p.sourcePartCount?`${p.sourcePartCount} OEM references · ${p.reference}`:'20 starter parts · OEM lookup required'):'Choose a BMW';
}
