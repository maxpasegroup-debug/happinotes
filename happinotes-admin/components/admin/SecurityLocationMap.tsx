'use client';

import { useEffect, useRef, useState } from 'react';
import { locationMessage, mapCoordinates, type SecurityGeo } from '@/lib/user-security';

type MapInstance = {
  remove(): void; invalidateSize(): void; setView(center: [number, number], zoom: number): MapInstance;
  getZoom(): number; on(event: string, handler: () => void): MapInstance;
};
type MapLayer = { addTo(map: MapInstance): MapLayer; on(event: string, handler: () => void): MapLayer };
type Leaflet = {
  map(element: HTMLElement, options: Record<string, unknown>): MapInstance;
  tileLayer(url: string, options: Record<string, unknown>): MapLayer;
  divIcon(options: Record<string, unknown>): unknown;
  marker(center: [number, number], options: Record<string, unknown>): MapLayer;
};
declare global { interface Window { L?: Leaflet } }
let leafletPromise: Promise<Leaflet> | undefined;
function loadLeaflet(): Promise<Leaflet> {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<Leaflet>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = 'anonymous';
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; script.crossOrigin = 'anonymous'; script.async = true;
    let cssReady = false, scriptReady = false, finished = false;
    const fail = () => { if (finished) return; finished = true; clearTimeout(timer); css.remove(); script.remove(); reject(new Error('Map library could not load. Check the connection and retry.')); };
    const done = () => { if (!finished && cssReady && scriptReady && window.L) { finished = true; clearTimeout(timer); resolve(window.L); } };
    const timer = setTimeout(fail, 12000);
    css.onload = () => { cssReady = true; done(); }; css.onerror = fail;
    script.onload = () => { scriptReady = true; if (!window.L) fail(); else done(); }; script.onerror = fail;
    document.head.append(css, script);
  }).catch(error => { leafletPromise = undefined; throw error; });
  return leafletPromise;
}

export default function SecurityLocationMap({ geo, kind = 'ip' }: { geo?: SecurityGeo; kind?: 'ip' | 'device' }) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState<{ key: string; value: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ key: string; error?: string } | null>(null);
  const point = mapCoordinates(geo), lat = point?.[0], lon = point?.[1];
  const key = `${kind}:${lat}:${lon}:${attempt}`;
  const initialZoom = lat === undefined ? 1 : kind === 'device' ? 15 : 10;
  useEffect(() => {
    const resize = () => {
      setFullscreen(document.fullscreenElement === frame.current);
      mapRef.current?.invalidateSize();
    };
    document.addEventListener('fullscreenchange', resize);
    return () => document.removeEventListener('fullscreenchange', resize);
  }, []);
  async function toggleExpanded() {
    if (document.fullscreenElement === frame.current) {
      await document.exitFullscreen().catch(() => {});
    } else if (expanded) setExpanded(false);
    else if (frame.current?.requestFullscreen && document.fullscreenEnabled) {
      try { await frame.current.requestFullscreen(); }
      catch { setExpanded(true); }
    } else setExpanded(true);
  }
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false, map: MapInstance | undefined, observer: ResizeObserver | undefined;
    void loadLeaflet().then(L => {
      if (disposed) return;
      map = L.map(element, { scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true, boxZoom: true, keyboard: true, zoomControl: true, attributionControl: true, minZoom: 0, maxZoom: 19, zoomSnap: 0.25, zoomDelta: 1 });
      mapRef.current = map;
      map.setView(lat !== undefined && lon !== undefined ? [lat, lon] : [20, 0], initialZoom);
      const updateZoom = () => { if (!disposed && map) setZoom({ key, value: map.getZoom() }); };
      map.on('zoomend', updateZoom); updateZoom();
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { minZoom: 0, maxZoom: 19, maxNativeZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' })
        .on('tileerror', () => { if (!disposed) setStatus({ key, error: 'Some map tiles could not load. Check your connection and retry.' }); }).addTo(map);
      if (lat !== undefined && lon !== undefined) L.marker([lat, lon], { title: kind === 'device' ? 'Reported device location' : 'Approximate IP location', icon: L.divIcon({
        className: '', iconSize: [28, 36], iconAnchor: [14, 34],
        html: '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 35S1 22 1 14a13 13 0 0 1 26 0c0 8-13 21-13 21Z" fill="#F27055" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="white"/></svg>',
      }) }).addTo(map);
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => map?.invalidateSize()); observer.observe(element); }
      map.invalidateSize();
      setStatus({ key });
    }).catch(error => { if (!disposed) setStatus({ key, error: error instanceof Error ? error.message : 'Map unavailable.' }); });
    return () => { disposed = true; observer?.disconnect(); if (mapRef.current === map) mapRef.current = null; map?.remove(); };
  }, [lat, lon, key, kind, initialZoom]);
  const current = status?.key === key ? status : null;
  return <div className="space-y-3">
    <div ref={frame} className={`relative isolate flex flex-col overflow-hidden border border-divider bg-content1 ${fullscreen ? 'h-[100dvh] w-screen' : 'rounded-2xl'}`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-divider bg-content1 px-3 py-2 text-xs">
        <span className="text-default-400 tabular-nums">Zoom {zoom?.key === key ? zoom.value : initialZoom} / 19</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!current} className="rounded-lg px-3 py-2 font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40" onClick={() => mapRef.current?.setView(lat !== undefined && lon !== undefined ? [lat, lon] : [20, 0], initialZoom)}>Reset view</button>
          <button type="button" aria-pressed={fullscreen || expanded} className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => void toggleExpanded()}>{fullscreen ? 'Exit fullscreen' : expanded ? 'Collapse map' : 'Expand map'}</button>
        </div>
      </div>
      <div className={`relative min-h-0 ${fullscreen ? 'flex-1' : expanded ? 'h-[75dvh] min-h-80' : 'h-64 sm:h-80'}`}>
        <div ref={container} role="region" aria-label={point ? (kind === 'device' ? 'Reported device location map' : 'Approximate user IP location map') : 'World map; user location unavailable'} className="relative z-0 h-full w-full bg-content2" />
        {!current && <div role="status" className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-content2/90 text-sm text-default-400">Loading map…</div>}
      </div>
      {current?.error && <p role="alert" className="shrink-0 bg-content1 px-3 py-2 text-xs text-warning">{current.error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Retry map</button></p>}
    </div>
    <p className="text-xs text-default-400">Scroll or pinch to zoom · Double-click to zoom in · Shift-drag to zoom an area</p>
    <p className="text-xs leading-5 text-default-400">{kind === 'device' ? 'Last location shared by the device, not a live tracker. Accuracy depends on the device and OS permission; coordinates are client-reported.' : locationMessage(geo?.status)}{!point && ' No user marker is shown.'}</p>
    {point && <a className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href={`https://www.openstreetmap.org/?${new URLSearchParams({ mlat: String(lat), mlon: String(lon) })}#map=${zoom?.key === key ? Math.round(zoom.value) : initialZoom}/${lat}/${lon}`} target="_blank" rel="noreferrer">Open full map ↗</a>}
  </div>;
}
