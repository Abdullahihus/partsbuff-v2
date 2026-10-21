# Repair videos

Part details now include a Repair videos section in both the inline selection panel and the full part page. Four selected YouTube guides cover N20/N26 F30 water pumps and thermostats, N51/N52 E9x cooling-system work, N52 E90/E92 ignition service, and F30 front Brembo M Sport brakes.

The site selects guides using the repair topic and explicit chassis/engine details in the part reference. Unknown or conflicting engines, different chassis, and unsupported brake configurations use a YouTube search instead of a selected guide. An OEM number shared across vehicles does not establish that the same repair procedure applies. Each video shows its scope and original creator. These are related procedures, not VIN-specific service instructions.

Players load only after clicking the video button. An Open on YouTube link remains available if an embed is disabled or unavailable. Search YouTube opens a search for the part's reference vehicle, known chassis and engine, and repair topic. These search results are external and are not reviewed by PartsBuff.

No YouTube API key is needed. This release does not automatically fetch videos and does not provide a selected video for every catalog part. All 70,000 catalog records and existing price snapshots are retained.

To add another selected guide, edit lib/repair-videos.ts. Add a real 11-character YouTube video ID, an accurate title and creator, supported repair topics, engine and chassis codes, scope, original URL and checked date. Confirm the creator's stated vehicle and procedure before adding it. Extend repairTopic for a new repair type and keep engine/body/equipment exclusions specific.

Initial source links:
- FCP Euro, F30 N20/N26 water pump and thermostat: https://www.youtube.com/watch?v=OXUP_OMi0oY
- Justin Buice, N52 spark plugs and coils (demonstrated on a 2006 330xi): https://www.youtube.com/watch?v=yMwKLljhfTE
- Zeiten, E9x water pump and thermostat (creator describes N51/N52): https://www.youtube.com/watch?v=eZxt-BaL1dE
- FCP Euro, front Brembo M Sport brakes: https://www.youtube.com/watch?v=b_StUoEQPnE
