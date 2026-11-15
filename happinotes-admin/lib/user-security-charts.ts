import type { SecurityUser } from './user-security.ts';

export type SecurityChartGroup = { label: string; count: number; userIds: string[]; color: string };
const palette = ['#fb923c', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#94a3b8'];
const colors: Record<string, string> = { Active: '#34d399', Authorized: '#34d399', 'Permanent ban': '#fb7185', 'Temporary ban': '#fbbf24', 'Deletion pending': '#94a3b8', 'Wi-Fi': '#fb923c', Cellular: '#38bdf8', Ethernet: '#a78bfa', 'Reported VPN': '#fb7185', Unknown: '#64748b', 'Not reported': '#64748b', 'Saved location': '#34d399', 'Sharing off': '#94a3b8', 'Permission denied': '#fbbf24', Replaced: '#fb923c', 'Signed out': '#38bdf8', Expired: '#a78bfa', Revoked: '#fb7185', Android: '#34d399', iOS: '#38bdf8', 'Within 1 hour': '#34d399', '1–24 hours': '#38bdf8', '1–7 days': '#a78bfa', 'Over 7 days': '#64748b', 'Unknown time': '#475569' };
function color(label: string) { return colors[label] || palette[[...label].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length]; }
function platform(os?: string) {
  if (!os) return 'Unknown';
  if (/android/i.test(os) || /^[^/]+\/[^/]+\/[^:]+:\d/.test(os)) return 'Android';
  if (/ios|iphone|ipad/i.test(os)) return 'iOS';
  if (/macos|mac os|darwin/i.test(os)) return 'macOS';
  if (/windows/i.test(os)) return 'Windows';
  if (/linux/i.test(os)) return 'Linux';
  return 'Unknown';
}
function group(items: { label: string; userId: string }[]): SecurityChartGroup[] {
  const counts = new Map<string, { count: number; ids: Set<string> }>();
  for (const item of items) {
    const entry = counts.get(item.label) || { count: 0, ids: new Set<string>() };
    entry.count++; entry.ids.add(item.userId); counts.set(item.label, entry);
  }
  return [...counts].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([label, entry]) => ({ label, count: entry.count, userIds: [...entry.ids], color: color(label) }));
}
const statuses: Record<string, string> = { active: 'Active', temporary_ban: 'Temporary ban', permanent_ban: 'Permanent ban', deletion_pending: 'Deletion pending' };
const sessions: Record<string, string> = { current: 'Authorized', replaced: 'Replaced', signed_out: 'Signed out', expired: 'Expired', revoked: 'Revoked' };
const connections: Record<string, string> = { wifi: 'Wi-Fi', cellular: 'Cellular', ethernet: 'Ethernet', vpn: 'Reported VPN', none: 'Disconnected', unknown: 'Unknown' };

/** Uses only the fetched page. No inferred location, online presence or fraud. */
export function securityChartData(users: readonly SecurityUser[], days: 7 | 30, now: Date) {
  const uniqueUsers = [...new Map(users.map(user => [user.id, user])).values()];
  const devices = uniqueUsers.flatMap(user => {
    const records = user.devices?.length ? user.devices : [user.legacyNetwork || user.network].filter(record => !!record);
    return [...new Map(records.map((device, index) => [device?._id || `legacy-${index}`, device])).values()].map(device => ({ device, userId: user.id }));
  });
  const logins = uniqueUsers.flatMap(user => [...new Map((user.loginHistory || []).map(session => [session.id, session])).values()].map(session => ({ session, userId: user.id })));
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysData = Array.from({ length: days }, (_, index) => {
    const timestamp = end - (days - 1 - index) * 86400000;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    return { date, label: new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }), count: 0, userIds: [] as string[] };
  });
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmap = weekdays.map(label => ({ label, hours: Array.from({ length: 24 }, (_, hour) => ({ label: `${label} ${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:59 UTC`, count: 0, userIds: [] as string[] })) }));
  let invalidDates = 0;
  for (const { session, userId } of logins) {
    const timestamp = Date.parse(session.startedAt);
    if (!Number.isFinite(timestamp)) { invalidDates++; continue; }
    if (timestamp > now.getTime()) continue;
    const point = daysData.find(day => day.date === new Date(timestamp).toISOString().slice(0, 10));
    if (point) {
      point.count++; if (!point.userIds.includes(userId)) point.userIds.push(userId);
      const date = new Date(timestamp), cell = heatmap[(date.getUTCDay() + 6) % 7].hours[date.getUTCHours()];
      cell.count++; if (!cell.userIds.includes(userId)) cell.userIds.push(userId);
    }
  }
  const vpn = uniqueUsers.filter(user => (user.vpn?.count || 0) > 0).map(user => ({ label: user.name || 'Unnamed user', count: user.vpn!.count, userIds: [user.id], color: '#fb7185' })).sort((a, b) => b.count - a.count);
  return {
    users: uniqueUsers.length, devices: devices.length, heatmap,
    platforms: group(devices.map(({ device, userId }) => ({ label: platform(device?.os), userId }))),
    deviceCounts: ['No reports', '1 device', '2 devices', '3+ devices'].map((label, index) => {
      const userIds = uniqueUsers.filter(user => { const count = devices.filter(device => device.userId === user.id).length; return index === 3 ? count >= 3 : count === index; }).map(user => user.id);
      return { label, count: userIds.length, userIds, color: palette[index] };
    }),
    vpnBands: ['No detections', '1–2', '3–4', '5+'].map((label, index) => {
      const userIds = uniqueUsers.filter(user => { const count = user.vpn?.count || 0; return index === 0 ? count === 0 : index === 1 ? count > 0 && count <= 2 : index === 2 ? count > 2 && count < 5 : count >= 5; }).map(user => user.id);
      return { label, count: userIds.length, userIds, color: ['#64748b', '#fbbf24', '#fb923c', '#fb7185'][index] };
    }),
    freshness: group(devices.map(({ device, userId }) => {
      const age = now.getTime() - Date.parse(device?.lastSeen || '');
      return { userId, label: !Number.isFinite(age) || age < 0 ? 'Unknown time' : age <= 3600000 ? 'Within 1 hour' : age <= 86400000 ? '1–24 hours' : age <= 7 * 86400000 ? '1–7 days' : 'Over 7 days' };
    })).sort((a, b) => ['Within 1 hour', '1–24 hours', '1–7 days', 'Over 7 days', 'Unknown time'].indexOf(a.label) - ['Within 1 hour', '1–24 hours', '1–7 days', 'Over 7 days', 'Unknown time'].indexOf(b.label)),
    authorized: logins.filter(({ session }) => session.status === 'current').length,
    vpnCount: vpn.reduce((sum, entry) => sum + entry.count, 0), vpn, days: daysData, invalidDates,
    access: group(uniqueUsers.map(user => ({ label: statuses[user.status] || 'Other', userId: user.id }))),
    networks: group(devices.map(({ device, userId }) => ({ label: connections[device?.networkType || 'unknown'] || 'Unknown', userId }))),
    sessions: group(logins.map(({ session, userId }) => ({ label: sessions[session.status] || 'Unknown', userId }))),
    location: group(devices.map(({ device, userId }) => ({ userId, label: device?.deviceLocation ? 'Saved location' : device?.locationStatus?.state === 'off' ? 'Sharing off' : device?.locationStatus?.state === 'permission_denied' ? 'Permission denied' : device?.locationStatus ? 'Awaiting a fix' : 'Not reported' }))),
  };
}
