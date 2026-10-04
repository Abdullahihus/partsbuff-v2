"use client";
import {createContext,useContext,useState} from 'react';
import {supportedCatalogProfile} from '@/lib/parts';
import {findBMWProfile} from '@/lib/catalog-index';
import type {VehicleContext} from '@/lib/catalog-provider';
export type SelectedVehicle=VehicleContext&{source?:'vin'|'manual'|'reference';warning?:string;fuelType?:string};
export const referenceVehicle:SelectedVehicle={vin:'',make:'BMW',year:'2011',model:'328i',trim:'E90 LCI',bodyClass:'Sedan',engine:'N51 · 3.0L inline-6',driveType:'RWD',catalogProfileId:supportedCatalogProfile.id,source:'reference'};
const Context=createContext<{vehicle:SelectedVehicle|null;setVehicle:(v:SelectedVehicle|null)=>void}>({vehicle:null,setVehicle:()=>{}});
export function VehicleProvider({children}:{children:React.ReactNode}){const [vehicle,setVehicle]=useState<SelectedVehicle|null>(null);return <Context.Provider value={{vehicle,setVehicle}}>{children}</Context.Provider>}
export function useVehicle(){return useContext(Context)}
export function hasPartCoverage(vehicle:SelectedVehicle|null){return Boolean(vehicle&&vehicle.make==='BMW'&&findBMWProfile(vehicle.year,vehicle.model))}
export function vehicleLabel(vehicle:SelectedVehicle|null){return vehicle?[vehicle.year,vehicle.make,vehicle.model].filter(Boolean).join(' '):'Choose your BMW'}
