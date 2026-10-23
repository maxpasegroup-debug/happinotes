const profile = process.env.EAS_BUILD_PROFILE;
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const fail = (message) => {
  console.error(`[HappiNotes build config] ${message}`);
  process.exit(1);
};

if (!profile) fail("EAS_BUILD_PROFILE is missing; build with an EAS profile.");
if (!apiUrl) fail(`EXPO_PUBLIC_API_URL is required for the '${profile}' build.`);

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  fail("EXPO_PUBLIC_API_URL must be a valid absolute URL.");
}

if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
  fail("EXPO_PUBLIC_API_URL must use HTTP or HTTPS.");
}

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);
if (profile !== 'development' && localHosts.has(parsedUrl.hostname)) {
  fail(`The '${profile}' profile cannot use a localhost API URL.`);
}

if (profile !== 'development' && parsedUrl.protocol !== 'https:') {
  fail(`The '${profile}' profile requires an HTTPS API URL.`);
}

console.log(`[HappiNotes build config] ${profile} API URL is valid.`);
