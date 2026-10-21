import type {Part} from './parts';

export type RepairVideo = {
  id: string; title: string; channel: string; topics: string[]; engines: string[];
  chassis: string[]; scope: string; sourceUrl: string; checkedOn: string;
};
export type RepairVehicle = {year?:string;make?:string;model?:string;engine?:string;catalogProfileId?:string};
export const repairVideos: RepairVideo[] = [
  {id:'OXUP_OMi0oY',title:'Replace the water pump and thermostat',channel:'FCP Euro',topics:['water-pump','thermostat'],engines:['N20','N26'],chassis:['F30'],scope:'Demonstrated on a BMW F30 with the N20/N26 engine family. Confirm your engine, drivetrain and hose layout.',sourceUrl:'https://www.youtube.com/watch?v=OXUP_OMi0oY',checkedOn:'2026-10-21'},
  {id:'yMwKLljhfTE',title:'Replace spark plugs and ignition coils',channel:'Justin Buice',topics:['spark-plugs','ignition-coils'],engines:['N52'],chassis:['E90','E92'],scope:'Demonstrated on a 2006 BMW 330xi E90 with the N52 engine. Other versions may use different plugs and access procedures.',sourceUrl:'https://www.youtube.com/watch?v=yMwKLljhfTE',checkedOn:'2026-10-21'},
  {id:'eZxt-BaL1dE',title:'Replace the E9x water pump and thermostat',channel:'Zeiten',topics:['water-pump','thermostat'],engines:['N51','N52'],chassis:['E90','E91','E92','E93'],scope:'Creator describes the E9x procedure for N51/N52 engines. Confirm your vehicle configuration and cooling-system procedure.',sourceUrl:'https://www.youtube.com/watch?v=eZxt-BaL1dE',checkedOn:'2026-10-21'},
  {id:'b_StUoEQPnE',title:'Replace front brake pads and discs — M Sport',channel:'FCP Euro',topics:['front-brakes'],engines:[],chassis:['F30'],scope:'Front Brembo M Sport brakes only. Standard brakes and rear brakes use different parts and procedures.',sourceUrl:'https://www.youtube.com/watch?v=b_StUoEQPnE',checkedOn:'2026-10-21'}
];

function engineCodes(text:string){return Array.from(new Set(text.toUpperCase().match(/\b[BNMS]\d{2}(?:TU\d?)?\b/g)||[]));}
function chassisCodes(text:string){return Array.from(new Set(Array.from(text.toUpperCase().matchAll(/\b([EFG]\d{2})(?:N|\s*LCI)?\b/g),m=>m[1])));}
export function repairTopic(part:Part){
 const text=[part.name,...part.aliases].join(' ').toLowerCase().replace(/[-_/]/g,' ');
 if(/\b(?:water|coolant)\s*pump\b|pompa.*acqua/.test(text)&&!/auxiliary|additional|intercooler|pulley|bracket|\bbolt\b|\bscrew\b/.test(text))return 'water-pump';
 if(/thermostat|termostat/.test(text))return 'thermostat';
 if(/spark\s*plug|candela|candele/.test(text))return 'spark-plugs';
 if(/ignition\s*coil|bobina.*accensione/.test(text))return 'ignition-coils';
 if(/brake\s*(pad|disc)|brake\s*rotor/.test(text)&&!/sensor|wear|sensore/.test(text)&&/front|anteriore/i.test(part.location+' '+part.name))return 'front-brakes';
 return '';
}
export function repairContext(part:Part,vehicle?:RepairVehicle|null){
 const legacy=!part.catalogProfileId||part.catalogProfileId==='bmw-e90-328i-n51-usa-2011-11';
 const reference=[part.vehicleLabel||'2011 BMW 328i',part.vehicleDetails||(legacy?'E90 N51':'')].join(' ');
 const selectedMatches=!!vehicle && (part.catalogProfileId===vehicle.catalogProfileId || (!legacy&&part.catalogProfileId===`bmw-${vehicle.year}-${vehicle.model?.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`));
 const sourceEngines=engineCodes(reference),selectedEngines=selectedMatches?engineCodes(vehicle?.engine||''):[];
 const conflict=!!selectedEngines.length&&!!sourceEngines.length&&!selectedEngines.some(e=>sourceEngines.includes(e));
 const engines=conflict?[]:selectedEngines.length?selectedEngines:sourceEngines;
 const chassis=chassisCodes(reference);
 return {reference,engines,chassis,conflict};
}
export function getRepairVideos(part:Part,vehicle?:RepairVehicle|null){
 const topic=repairTopic(part),context=repairContext(part,vehicle);
 if(!topic||context.conflict||context.chassis.length!==1)return [];
 return repairVideos.filter(v=>v.topics.includes(topic)&&v.chassis.includes(context.chassis[0])&&(!v.engines.length||(context.engines.length===1&&v.engines.includes(context.engines[0])))&&
  (topic!=='front-brakes'||/brembo|m[ -]?sport|S2NHA/i.test(part.name+' '+(part.sourceRestrictions||[]).filter(s=>!/without|not.*sport/i.test(s)).join(' '))));
}
export function repairSearchUrl(part:Part,vehicle?:RepairVehicle|null){
 const context=repairContext(part,vehicle);const topic=repairTopic(part);
 const query=[part.vehicleLabel||'2011 BMW 328i',...context.chassis,...context.engines,topic?topic.replace(/-/g,' '):part.name.slice(0,120),'replacement tutorial'].join(' ');
 return 'https://www.youtube.com/results?search_query='+encodeURIComponent(query);
}
