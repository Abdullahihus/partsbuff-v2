import type {Metadata} from 'next';
import './globals.css';
import {Shell} from '@/components/partsbuff';
import {VehicleProvider} from '@/components/vehicle-context';
export const metadata:Metadata={title:'PartsBuff — Find your part',description:'Describe a part in your own words, explore BMW OEM references, and compare retailer options.',icons:{icon:'/partsbuff-logo.png',shortcut:'/partsbuff-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><VehicleProvider><Shell>{children}</Shell></VehicleProvider></body></html>}
