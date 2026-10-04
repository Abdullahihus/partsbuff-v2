import { parts, supportedCatalogProfile, type Part } from './parts';
import {findBMWProfile, type BMWProfile} from './catalog-index';
import {readProfileParts} from './catalog-reader';
export type VehicleContext = {vin:string;year?:string;make?:string;model?:string;trim?:string;bodyClass?:string;engine?:string;driveType?:string;catalogProfileId?:string};
export type CatalogResult={source:'verified-e90-subset'|'bmw-reference-catalog';parts:Part[];supported:boolean;profile:typeof supportedCatalogProfile|BMWProfile;message?:string};
export async function getCatalogCandidates(vehicle:VehicleContext):Promise<CatalogResult>{
 if(vehicle.catalogProfileId===supportedCatalogProfile.id){
  const valid=vehicle.make==='BMW'&&String(vehicle.year)==='2011'&&vehicle.model==='328i'&&vehicle.bodyClass==='Sedan'&&(vehicle.engine||'').includes('N51');
  return {source:'verified-e90-subset',parts:valid?parts:[],supported:valid,profile:supportedCatalogProfile,message:valid?'Using the original N51 reference.':'Vehicle details do not match this catalog reference.'};
 }
 const profile=vehicle.make==='BMW'?findBMWProfile(vehicle.year,vehicle.model):undefined;
 if(!profile||(vehicle.catalogProfileId&&vehicle.catalogProfileId!==profile.id))return {source:'bmw-reference-catalog',parts:[],supported:false,profile:supportedCatalogProfile,message:'Select a listed BMW model from 2000 through 2026.'};
 return {source:'bmw-reference-catalog',parts:await readProfileParts(profile),supported:true,profile,message:'Catalog references require VIN, engine, build date and option checks before ordering.'};
}
