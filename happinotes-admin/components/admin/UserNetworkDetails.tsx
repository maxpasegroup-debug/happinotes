'use client';

import { useEffect, useState } from 'react';
import { displayError } from "@/lib/api";
import Image from 'next/image';
import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Skeleton } from '@heroui/react';
import SecurityLocationMap from '@/components/admin/SecurityLocationMap';
import { devicePhotoMessage, displayDetail, locationMessage, deviceLocationMessage, type DevicePhoto, type SecurityLookup, type SecurityUser, type SecurityNetwork } from '@/lib/user-security';

function Fields({ items }: { items: [string, unknown][] }) {
  return <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="min-w-0 border-b border-divider/60 py-3"><dt className="text-xs text-default-400">{label}</dt><dd className={`mt-1 break-words text-sm ${displayDetail(value) === 'Not provided' ? 'text-default-400' : 'font-medium text-foreground'}`}>{displayDetail(value)}</dd></div>)}</dl>;
}
function DeviceReference({ model, os, photo, loading, onRetry }: { model?: string; os?: string; photo?: DevicePhoto; loading: boolean; onRetry: () => void }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState('');
  const imageUrl = [photo?.imageUrl, photo?.thumbnailUrl].find((url): url is string => Boolean(url && !failed.includes(url)));
  const candidate = photo?.status === 'found' && photo.model.toLowerCase() === model?.toLowerCase() && imageUrl && photo.sourceUrl && photo.modelSourceUrl;
  const showingPhoto = candidate && loaded === imageUrl;
  return <div className="flex items-start gap-4">
    <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-2xl border border-divider bg-content2 sm:h-48 sm:w-36">
      {loading || candidate && !showingPhoto ? <Skeleton className="h-full w-full" aria-label="Loading device reference photo" /> : !showingPhoto ? <div role="status" className="flex h-full items-center justify-center p-4 text-center text-xs leading-5 text-default-400">{!model ? 'Model not reported' : failed.length ? 'Image could not load' : photo?.reason === 'ambiguous_match' ? 'Shared model code' : 'Reference image unavailable'}</div> : null}
      {candidate && <Image unoptimized src={imageUrl!} referrerPolicy="no-referrer" alt={`Model photo: ${photo.matchedModel || model}`} fill sizes="(min-width: 640px) 144px, 128px" className={`bg-white object-contain p-3 transition-opacity motion-reduce:transition-none ${showingPhoto ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setLoaded(imageUrl!)} onError={() => setFailed(previous => [...previous, imageUrl!])} />}
    </div>
    <div className="min-w-0 space-y-2 py-1 text-xs leading-5 text-default-400">
      <p className="break-words text-base font-semibold leading-6 text-foreground">{model || 'Device'}</p>
      {os && <p>{os}</p>}
      {photo?.resolvedModel && <p>{photo.resolvedModel}{photo.modelMappingUrl && <> · <a href={photo.modelMappingUrl} target="_blank" rel="noreferrer" className="underline">Model catalog</a></>}</p>}
      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{showingPhoto ? photo.provider === 'serper' ? 'Model search reference' : 'Matched model photo' : model ? 'Reported device model' : 'Model unknown'}</span>
      {showingPhoto && photo.provider !== 'serper' && <><p>{photo.matchedModel} · <a href={photo.modelSourceUrl} target="_blank" rel="noreferrer" className="underline">Model match</a></p>{photo.author && <p className="break-words">Photo: {photo.author}</p>}<p><a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">Wikimedia source</a>{photo.license && ' · '} {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="underline">{photo.license}</a> : photo.license}</p></>}
      {showingPhoto && photo.provider === 'serper' && <><p className="break-words text-foreground">{photo.searchTitle}</p><p>{photo.sharedModelCode ? 'This code is shared by multiple products. Showing a search reference, not a verified exact device.' : 'Search reference for the reported model; appearance may differ.'} Image rights remain with the source.</p></>}
      {loading || candidate && !showingPhoto ? <p role="status">{candidate ? 'Loading the model photo…' : 'Searching for a device reference…'}</p> : !showingPhoto && <><p role="status">{failed.length ? 'The model photo was found, but the image could not load in this browser.' : devicePhotoMessage(photo)}</p><Button size="sm" variant="flat" color="primary" onPress={onRetry}>Retry device image</Button>{failed.length > 0 && photo?.sourceUrl && <a className="block underline" href={photo.sourceUrl} target="_blank" rel="noreferrer">Open photo source ↗</a>}</>}
    </div>
  </div>;
}
export default function UserNetworkDetails({ user, page, query }: { user: SecurityUser; page: number; query: string }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const mainSession = user.loginHistory?.find(session => session.status === 'current') || user.loginHistory?.[0];
  const olderSessions = user.loginHistory?.filter(session => session.id !== mainSession?.id) || [];
  const devices = user.devices || [];
  const selectedDevice = devices.find(device => device._id === selectedDeviceId) || devices.find(device => device._id === mainSession?.deviceId) || devices[0];
  const legacy = user.legacyNetwork || (!devices.length ? user.network : undefined);
  const network = selectedDeviceId === 'legacy' ? legacy : selectedDevice || legacy;
  const viewingLegacy = selectedDeviceId === 'legacy' || !selectedDevice;
  const renderSession = (session: NonNullable<SecurityUser['loginHistory']>[number]) => <li key={session.id} className="rounded-xl border border-divider p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{session.deviceModel || 'Device details not reported'}</span><Chip size="sm" variant="flat" color={session.status === 'current' ? 'success' : 'default'}>{({ current: 'Current session', replaced: 'Replaced by newer login', signed_out: 'Signed out', expired: 'Expired', revoked: 'Revoked' })[session.status]}</Chip></div>
        <p className="mt-2 text-xs text-default-400">Signed in: {new Date(session.startedAt).toLocaleString()}{session.endedAt ? ` · Ended: ${new Date(session.endedAt).toLocaleString()}` : ''}</p>
        <p className="mt-1 text-xs text-default-400">{[session.os, session.osVersion, session.publicIp].filter(Boolean).join(' · ') || 'Security metadata not available'}</p>
        {session.deviceId && devices.some(device => device._id === session.deviceId) && <Button className="mt-2" size="sm" variant="light" color="primary" onPress={() => setSelectedDeviceId(session.deviceId!)}>View this device</Button>}
      </li>;
  return <div className="space-y-5">
    <section aria-label="Login history" className="rounded-2xl border border-divider p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Login & device history</h3><Chip size="sm" variant="flat" color="primary">{mainSession?.status === 'current' ? 'One active session' : 'No active session'}</Chip></div>
      <p className="mt-2 text-xs leading-5 text-default-400">Current session first. Scroll below for earlier logins. Status indicates authorization, not online presence.</p>
      {mainSession ? <>
        <ol className="mt-4">{renderSession(mainSession)}</ol>
        {olderSessions.length > 0 && <details className="mt-4 border-t border-divider pt-3" open>
          <summary className="cursor-pointer text-sm font-medium text-default-500">Previous logins · {olderSessions.length}</summary>
          <ol tabIndex={0} aria-label="Previous logins" className="mt-3 max-h-60 space-y-3 overflow-y-auto overscroll-contain pr-2 focus-visible:outline-primary">{olderSessions.map(renderSession)}</ol>
        </details>}
      </> : <p className="mt-3 text-sm text-default-400">No login history reported yet.</p>}
    </section>
    {devices.length > 0 && <section aria-label="Account devices"><div className="mb-3 flex items-center gap-2"><h3 className="font-semibold">Devices</h3><Chip size="sm" variant="flat">{devices.length}</Chip></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{devices.map((device, index) => <button type="button" key={device._id} aria-pressed={!viewingLegacy && selectedDevice?._id === device._id} onClick={() => setSelectedDeviceId(device._id || '')} className={`min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${!viewingLegacy && selectedDevice?._id === device._id ? 'border-primary bg-primary/10' : 'border-divider bg-content2/40 hover:bg-content2'}`}><span className="block truncate text-sm font-semibold">{device.deviceModel || 'Unknown device'} · {index + 1}</span><span className="mt-1 block text-xs font-medium text-primary">{user.loginHistory?.some(session => session.status === 'current' && session.deviceId === device._id) ? 'Current session' : 'Previous device report'}</span><span className="mt-1 block truncate text-xs text-default-400">{device.os || 'Unknown OS'} · {device.networkType || 'Unknown connection'}</span><span className="mt-1 block text-xs text-default-400">Last report: {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Unavailable'}</span></button>)}</div></section>}
    {legacy && <Button size="sm" variant={viewingLegacy ? 'solid' : 'flat'} onPress={() => setSelectedDeviceId('legacy')}>View older device snapshot</Button>}
    {!devices.length && network && <p className="text-xs text-default-400">Legacy device report. Updated app builds will list each installation separately.</p>}
    <NetworkDetails key={`${user.id}:${viewingLegacy ? 'legacy' : selectedDevice?._id}`} user={user} network={network} deviceId={viewingLegacy ? undefined : selectedDevice?._id} page={page} query={query} />
  </div>;
}
function NetworkDetails({ user, network, deviceId, page, query }: { user: SecurityUser; network?: SecurityNetwork; deviceId?: string; page: number; query: string }) {
  const [attempt, setAttempt] = useState(0);
  const [deviceDetailsOpen, setDeviceDetailsOpen] = useState(false);
  const [retryImage, setRetryImage] = useState(false);
  const refresh = (image = false) => { setRetryImage(image); setAttempt(value => value + 1); };
  const [result, setResult] = useState<{ key: string; data?: SecurityLookup; error?: string } | null>(null);
  const key = `${user.id}:${deviceId || 'legacy'}:${network?.publicIp || ''}:${network?.deviceModel || ''}:${page}:${query}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ userId: user.id, page: String(page), query, ...(deviceId ? { deviceId } : {}), ...(retryImage ? { retryImage: '1' } : {}) });
    void fetch(`/api/admin/user-network?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.geo) {
          if (active) setResult({ key, error: displayError(data?.message, 'Could not load IP details. Please retry.') });
          return;
        }
        if (data.userId !== user.id || (deviceId && data.deviceId !== deviceId) || data.publicIp !== (network?.publicIp || '')) {
          if (active) setResult({ key, error: 'The network report changed. Refresh the user list to see its latest details.' });
          return;
        }
        if (active) setResult({ key, data });
      }).catch(error => { if (active) setResult({ key, error: error instanceof Error && error.name === 'TimeoutError' ? 'Lookup timed out. Please retry.' : 'Unable to load IP details. Check your connection and retry.' }); });
    return () => { active = false; controller.abort(); };
  }, [user.id, deviceId, network?.publicIp, key, page, query, retryImage]);
  const current = result?.key === key ? result : null;
  const loading = !current;
  const lookup = current?.data;
  const liveGeo = lookup?.geo.status === 'approximate';
  const geo = liveGeo ? lookup!.geo : network?.geo?.status === 'approximate' ? network.geo : lookup?.geo || network?.geo;
  const location = network?.deviceLocation;
  const source = liveGeo ? `${lookup!.geo.source || 'IP lookup'}${lookup!.geo.stale ? ' · cached' : ''}` : network?.geo?.status === 'approximate' ? 'Saved backend report' : 'Awaiting location';
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-content2/40 p-3"><div className="min-w-0"><p className="text-xs text-default-400">Reported public IP</p><p className="break-all font-mono text-base font-semibold">{network?.publicIp || 'Not reported'}</p></div><Button size="sm" variant="flat" color="primary" isLoading={loading} onPress={() => refresh()}>{loading ? 'Looking up details' : 'Refresh lookup'}</Button></div>
    {current?.error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{current.error}</p>}
    {lookup && !liveGeo && <p role="status" className="rounded-xl bg-warning/10 p-3 text-sm text-warning">{locationMessage(lookup.geo.status)}{network?.geo?.status === 'approximate' ? ' Showing the last saved location below.' : ''}{lookup.geo.retryAt ? ` Next provider attempt after ${new Date(lookup.geo.retryAt).toLocaleString()}.` : ''}</p>}
    {lookup?.geo.stale && <p role="status" className="rounded-xl bg-warning/10 p-3 text-sm text-warning">The location services are unavailable. Showing a cached location from {new Date(lookup.geo.checkedAt!).toLocaleString()}.</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="min-w-0"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-semibold">IP & location</h3><Chip size="sm" variant="flat">{source}</Chip></div><p className="text-xs leading-5 text-default-400">Latest available provider result{geo?.checkedAt ? ` · ${new Date(geo.checkedAt).toLocaleString()}` : ''}</p>
        {geo?.source === 'DB-IP Lite' && <p className="mt-1 text-xs text-default-500">
          <a href="https://db-ip.com/" target="_blank" rel="noopener noreferrer" className="underline">IP Geolocation by DB-IP</a>
          {geo.databaseDate && ` · Database dated ${geo.databaseDate}`}
        </p>}
        {loading && !geo && <Skeleton className="mt-3 h-1 w-full rounded-full" />}
        <Fields items={[
          ['Country', geo?.country], ['Country ISO', geo?.countryCode], ['State / region', geo?.region], ['City', geo?.city], ['Postal code', geo?.postal], ['Time zone', geo?.timezone], ['Latitude', geo?.latitude], ['Longitude', geo?.longitude], ['ASN', geo?.asn], ['Organization', geo?.organization || geo?.provider], ['ISP (location provider)', geo?.isp], ['AS name', undefined],
        ]} />
      </section>
      <section className="min-w-0"><h3 className="mb-3 font-semibold">Map view</h3><SecurityLocationMap geo={geo} /></section>
    </div>
    <section className="border-t border-divider pt-5" aria-label="Device location">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Device location</h3><Chip size="sm" variant="flat">{location ? 'Last shared location' : 'Awaiting device location'}</Chip></div>
      {location ? <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div><Fields items={[
          ['Latitude', location.latitude], ['Longitude', location.longitude],
          ['Reported accuracy', location.accuracy !== null ? `±${location.accuracy} m` : undefined],
          ['Captured', new Date(location.capturedAt).toLocaleString()], ['Received', new Date(location.receivedAt).toLocaleString()],
          ['Mock location reported', location.mocked],
        ]} /><p className="mt-3 text-xs leading-5 text-default-400">Stored separately from the IP lookup. This is the last shared location and may be approximate or out of date.</p></div>
        <SecurityLocationMap kind="device" geo={{ status: 'approximate', latitude: location.latitude, longitude: location.longitude }} />
      </div> : <p className="text-sm leading-6 text-default-400">{deviceLocationMessage(network?.locationStatus?.state)}</p>}
      {network?.locationStatus?.checkedAt && <p className="mt-3 text-xs text-default-400">Last location check: {new Date(network.locationStatus.checkedAt).toLocaleString()}</p>}
      {location && network?.locationStatus?.state && network.locationStatus.state !== 'ready' && <p className="mt-3 text-xs text-warning">{deviceLocationMessage(network.locationStatus.state)} Showing the last saved point above.</p>}
    </section>
    <section className="border-t border-divider pt-5"><h3 className="mb-4 font-semibold">Device & connection</h3><div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]"><DeviceReference key={`${user.id}:${network?.deviceModel || ''}:${attempt}`} model={network?.deviceModel} os={network?.os} photo={lookup?.device} loading={loading} onRetry={() => refresh(true)} /><div className="min-w-0"><Fields items={[
      ['Operating system', network?.os], ['OS version', network?.osVersion], ['Connection type (reported)', network?.networkType], ['Last report', network?.lastSeen ? new Date(network.lastSeen).toLocaleString() : undefined],
    ]} /><Button className="mt-4" size="sm" color="primary" variant="flat" onPress={() => setDeviceDetailsOpen(true)}>View device details</Button></div></div></section>
    <Modal size="3xl" isOpen={deviceDetailsOpen} onClose={() => setDeviceDetailsOpen(false)} scrollBehavior="inside" placement="center" classNames={{ base: 'admin-ui admin-modal-panel bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 border-b border-divider pr-12"><span>Device details</span><span className="text-sm font-normal text-default-400">{network?.deviceModel || 'Model not reported'}</span></ModalHeader>
        <ModalBody className="space-y-5 py-5">
          <DeviceReference key={`details:${user.id}:${network?.deviceModel || ''}:${attempt}`} model={network?.deviceModel} os={network?.os} photo={lookup?.device} loading={loading} onRetry={() => refresh(true)} />
          <section><h3 className="font-semibold">Reported device & connection</h3><Fields items={[
            ['Device record', deviceId], ['First report', network?.firstSeen ? new Date(network.firstSeen).toLocaleString() : undefined], ['Model code', network?.deviceModel], ['Operating system', network?.os], ['OS version', network?.osVersion], ['Connection type', network?.networkType], ['SIM carrier', network?.carrier], ['Device IP', network?.deviceIp], ['Public IP', network?.publicIp], ['Last report', network?.lastSeen ? new Date(network.lastSeen).toLocaleString() : undefined],
          ]} /></section>
          <section><h3 className="font-semibold">Device reference</h3><Fields items={[
            ['Image cache', lookup?.device.cacheStorage === 'mongodb' ? 'Saved in database' : lookup?.device.cacheStorage === 'memory' ? 'Memory only — database cache unavailable' : undefined], ['Image fetched', lookup?.device.fetchedAt ? new Date(lookup.device.fetchedAt).toLocaleString() : undefined], ['Catalog product name', lookup?.device.resolvedModel], ['Search result title', lookup?.device.searchTitle], ['Reference model', lookup?.device.matchedModel], ['Shared model code', lookup?.device.sharedModelCode],
          ]} /><p className="mt-3 text-xs leading-5 text-default-400">These are the available reported and reference details. Hardware specifications such as RAM, storage and chipset have not been supplied by the app or image search.</p></section>
        </ModalBody>
        <ModalFooter className="border-t border-divider"><Button variant="flat" onPress={() => setDeviceDetailsOpen(false)}>Close</Button></ModalFooter>
      </ModalContent>
    </Modal>
    <section className="rounded-xl border border-divider p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Network risk details</h3><Chip size="sm" variant="flat">Not assessed</Chip></div><p className="mt-2 text-xs leading-5 text-default-400">The connected location source does not provide these checks. Missing results do not mean a network is safe or malicious.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{['Proxy', 'Tor', 'Hosting', 'Cloud', 'Mobile IP', 'Crawler', 'Network scanner', 'Snort', 'Threat level', 'Inbound risk', 'Outbound risk'].map(label => <div key={label}><p className="text-xs text-default-400">{label}</p><p className="mt-1 text-sm text-default-400">Not provided</p></div>)}</div><p className="mt-4 border-t border-divider pt-3 text-xs leading-5 text-default-400">IP2Location, DB-IP, IPinfo and Criminal IP are not connected. Their results require separate provider integrations.</p></section>
  </div>;
}
