import type {Part} from './parts';
import type {BMWProfile} from './catalog-index';
const starterParts=[
 ['front-brake-pads','Front brake pad set','Brakes','Front wheels','squeaking brakes worn front pads'],
 ['rear-brake-pads','Rear brake pad set','Brakes','Rear wheels','squeaking brakes worn rear pads'],
 ['front-brake-rotor','Front brake rotor','Brakes','Front wheels','brake disc vibration stopping'],
 ['rear-brake-rotor','Rear brake rotor','Brakes','Rear wheels','rear brake disc vibration'],
 ['front-brake-caliper','Front brake caliper','Brakes','Front wheels','sticking brake caliper'],
 ['rear-brake-caliper','Rear brake caliper','Brakes','Rear wheels','rear sticking caliper'],
 ['brake-wear-sensor','Brake pad wear sensor','Brakes','Brake pads','brake pad warning sensor'],
 ['cabin-air-filter','Cabin air filter','HVAC','Cabin air intake','pollen filter microfilter air conditioning smell'],
 ['wiper-blades','Windshield wiper blade set','Wash / Wipe','Windshield','wipers streaks rain'],
 ['washer-pump','Windshield washer pump','Wash / Wipe','Washer reservoir','washer fluid not spraying'],
 ['headlight','Headlight assembly','Lighting','Front exterior','headlamp front light broken'],
 ['taillight','Taillight assembly','Lighting','Rear exterior','rear tail lamp broken'],
 ['exterior-mirror','Exterior mirror assembly','Body','Side of vehicle','side mirror broken'],
 ['window-regulator','Window regulator','Door','Inside door','window falls stuck regulator'],
 ['hood-strut','Hood support strut','Body','Engine or front compartment','bonnet hood falls gas strut'],
 ['12v-battery','12-volt battery','Electrical','See vehicle battery diagram','12v battery low voltage starting'],
 ['front-wheel-bearing','Front wheel bearing','Suspension','Front wheel hub','wheel bearing humming grinding'],
 ['front-control-arm','Front control arm','Suspension','Front suspension','wishbone control arm bushings clunk'],
 ['tie-rod','Tie rod end','Steering','Front steering linkage','steering loose tie rod'],
 ['wheel-speed-sensor','Wheel speed sensor','Electrical','Wheel hub','abs traction warning speed sensor']
] as const;
/** Starter references identify a part to research, never a confirmed OEM fitment. */
export function makeStarterParts(profile:BMWProfile,count=20):Part[]{
 return starterParts.slice(0,count).map(([slug,name,category,location,keywords])=>({
 id:`${profile.id}-starter-${slug}`,name,category,location,
 description:`A starter reference for researching ${name.toLowerCase()} on a ${profile.year} BMW ${profile.model}. Confirm the component, side and equipment in the VIN-specific catalog.`,
 aliases:keywords.split(' '),symptoms:[],oemNumber:'',
 fitmentNotes:'OEM number and exact fitment have not been verified. Select the correct engine, body style, build date and options in RealOEM or ask a BMW parts specialist using your VIN.',
 verification:'lookup-required',sourceLabel:'RealOEM · vehicle lookup required',sourceUrl:'https://www.realoem.com/bmw/enUS/select',
 vehicleLabel:`${profile.year} BMW ${profile.model}`,vehicleDetails:'Starter reference · OEM lookup required',catalogProfileId:profile.id
 }));
}
