export type SecurityGeo = {
  status?: string; latitude?: number; longitude?: number; city?: string; region?: string;
  country?: string; countryCode?: string; postal?: string; timezone?: string;
  provider?: string; organization?: string; asn?: string; checkedAt?: string;
  source?: 'ipapi.co' | 'ipwho.is' | 'DB-IP Lite'; databaseDate?: string; isp?: string; retryAt?: string; stale?: boolean;
};
export type ReportedDeviceLocation = {
  latitude: number; longitude: number; accuracy: number | null;
  capturedAt: string; receivedAt: string; consentVersion: 1; mocked?: boolean;
};
export type SecurityNetwork = { _id?: string; publicIp?: string; deviceIp?: string; networkType?: string; carrier?: string;
  deviceModel?: string; os?: string; osVersion?: string; firstSeen?: string; lastSeen?: string; deviceLocation?: ReportedDeviceLocation; locationStatus?: { state: string; checkedAt: string }; geo?: SecurityGeo };
export type LoginSession = { id: string; deviceId?: string; deviceModel?: string; os?: string; osVersion?: string; publicIp?: string;
  startedAt: string; lastSeen?: string; expiresAt: string; endedAt?: string; status: 'current' | 'replaced' | 'signed_out' | 'expired' | 'revoked' };
export type SecurityUser = {
  id: string; name: string; email?: string; status: string; reason?: string; expiresAt?: string;
  history: { action: string; reason: string; at: string }[];
  network?: SecurityNetwork;
  devices?: SecurityNetwork[];
  legacyNetwork?: SecurityNetwork | null;
  loginHistory?: LoginSession[];
  vpn?: { count: number; lastDetectedAt?: string; lastIp?: string; ipBlocked?: boolean };
};
export type DevicePhoto = {
  status: 'found' | 'not_found' | 'unavailable'; model: string; matchedModel?: string; resolvedModel?: string; modelMappingUrl?: string;
  reason?: 'model_missing' | 'model_unsupported' | 'no_catalog_match' | 'ambiguous_match' | 'no_catalog_photo' | 'image_metadata_unavailable' | 'catalog_unavailable' | 'busy';
  imageUrl?: string; sourceUrl?: string; modelSourceUrl?: string; author?: string; license?: string; licenseUrl?: string;
  thumbnailUrl?: string; provider?: 'serper'; sourceLabel?: string;
  searchTitle?: string; sharedModelCode?: boolean;
  cacheStorage?: 'mongodb' | 'memory'; fetchedAt?: string;
};
export type SecurityLookup = { deviceId?: string; userId: string; publicIp: string; geo: SecurityGeo; device: DevicePhoto };
export function mapCoordinates(geo?: SecurityGeo): [number, number] | null {
  if (geo?.status !== 'approximate' || typeof geo.latitude !== 'number' || typeof geo.longitude !== 'number' || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude) || Math.abs(geo.latitude) > 85 || Math.abs(geo.longitude) > 180) return null;
  return [geo.latitude, geo.longitude];
}
export function locationMessage(status?: string) {
  switch (status) {
    case 'not_configured': return 'No saved location yet. Look up the reported IP to locate it.';
    case 'disabled': return 'IP lookup is disabled by the administrator.';
    case 'no_public_ip': return 'A public IP has not been reported. Private/local IPs cannot be located.';
    case 'rate_limited': return 'Available location services are temporarily rate-limited. Showing a saved location when available; please retry after the indicated time.';
    case 'busy': return 'Several location lookups are running. Please retry shortly.';
    case 'provider_rejected': return 'The location provider rejected the request. Check its API key and account.';
    case 'approximate': return 'Approximate network location. A VPN or mobile gateway can place this pin far from the device.';
    default: return 'Location is currently unavailable. Retry the lookup when the connection is available.';
  }
}
export function displayDetail(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not provided';
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

export function devicePhotoMessage(photo?: DevicePhoto): string {
  switch (photo?.reason) {
    case 'model_missing': return 'The app has not reported a device model yet.';
    case 'model_unsupported': return 'The reported model format could not be searched.';
    case 'no_catalog_match': return 'No exact catalog match for this model code yet.';
    case 'ambiguous_match': return 'This model code is shared by multiple devices. The full product name is needed to select the correct photo.';
    case 'no_catalog_photo': return 'The exact model was found, but its catalog record has no photo.';
    case 'image_metadata_unavailable': return 'The model was found, but its photo could not be retrieved with source details.';
    case 'busy': return 'Other device lookups are running. Retry shortly.';
    case 'catalog_unavailable': return 'The device image catalog could not be reached. Retry the image lookup.';
    default: return photo?.status === 'not_found' ? 'No exact photo is available for the reported model.' : 'Device image lookup is unavailable. Retry the image lookup.';
  }
}

export function deviceLocationMessage(state?: string) {
  switch (state) {
    case 'off': return 'Location sharing is off on this installation. In the app, enable Profile → Share device location, then grant location permission.';
    case 'permission_denied': return 'The phone has not granted location permission. Allow location for HappiNotes in phone settings, then tap Refresh device location in Profile.';
    case 'services_disabled': return 'Location services are off on the phone. Turn them on, then tap Refresh device location in Profile.';
    case 'native_unavailable': return 'This app build lacks the location module. Install the rebuilt app, then enable location sharing in Profile.';
    case 'timeout': return 'The phone could not obtain a location fix in time. Try near a window or outdoors, then tap Refresh device location in Profile.';
    case 'unavailable': return 'The phone reported a location error. Check phone settings and retry Refresh device location in Profile.';
    case 'ready': return 'A location report was received, but no coordinates are available in this record. Refresh the user list.';
    default: return 'No location result has been reported by this installation yet. Open the updated app, enable Profile → Share device location, allow the OS permission, and tap Refresh device location. An IP lookup cannot supply the phone’s GPS coordinates.';
  }
}
