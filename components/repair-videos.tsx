"use client";
import {useState} from 'react';
import {ExternalLink,Play,Video} from 'lucide-react';
import type {Part} from '@/lib/parts';
import {getRepairVideos,repairContext,repairSearchUrl,type RepairVideo} from '@/lib/repair-videos';
import {useVehicle} from './vehicle-context';

function VideoCard({video}:{video:RepairVideo}){
 const [loaded,setLoaded]=useState(false);
 return <article className="repair-video-card">
  <div className="repair-video-player">{loaded?<iframe title={video.title+' — '+video.channel} src={`https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0`} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button type="button" className="repair-video-load" onClick={()=>setLoaded(true)} aria-label={'Load video: '+video.title}><span className="repair-play-icon"><Play size={28}/></span><strong>Watch repair video</strong><small>Loads the YouTube player</small></button>}</div>
  <div className="repair-video-body"><span className="repair-video-channel">{video.channel}</span><h3>{video.title}</h3><p>{video.scope}</p><a href={video.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Open on YouTube<ExternalLink size={14}/></a></div>
 </article>;
}
export function RepairVideos({part}:{part:Part}){
 const {vehicle}=useVehicle();const videos=getRepairVideos(part,vehicle);const context=repairContext(part,vehicle);
 return <section className="repair-videos" aria-label="Repair videos">
  <div className="section-heading"><div><div className="eyebrow">UNDERSTAND THE REPAIR</div><h2><Video size={24}/>Repair videos</h2></div><a className="secondary-button" href={repairSearchUrl(part,vehicle)} target="_blank" rel="noopener noreferrer">Search YouTube<ExternalLink size={16}/></a></div>
  <p className="repair-reference">For this part reference: <strong>{part.vehicleLabel||'2011 BMW 328i'}</strong>{context.chassis.length>0&&' · '+context.chassis.join(' / ')}{context.engines.length>0&&' · '+context.engines.join(' / ')}</p>
  {videos.length?<><p className="subtle">Selected guides for this repair and vehicle family. Confirm the engine, equipment and procedure before starting.</p><div className="repair-video-grid">{videos.map(video=><VideoCard key={part.id+video.id} video={video}/>)}</div></>:<div className="repair-video-empty"><Video size={30}/><div><h3>No selected guide for this exact reference yet.</h3><p>Search YouTube using this vehicle and part. Check the result’s engine, chassis and equipment against your car.</p></div></div>}
  <p className="repair-video-note">Videos belong to their creators. A related guide does not verify part fitment. Follow the vehicle service procedure and torque specifications; use professional help when needed. If a player is unavailable, use “Open on YouTube.”</p>
 </section>;
}
