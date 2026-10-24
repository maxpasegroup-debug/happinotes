const _knownProductionHosts = {
  'happinotes-production-6b44.up.railway.app',
};

const _localHosts = {
  'localhost',
  '127.0.0.1',
  '::1',
  '10.0.2.2',
  '10.0.3.2',
};

const _developmentHostLabels = {
  'dev',
  'development',
  'test',
  'testing',
  'staging',
  'sandbox',
};

class _ReleaseApiUrlRequirement {
  const _ReleaseApiUrlRequirement(this.value, {required this.isRelease})
    : assert(
        !isRelease || value != '',
        'Release builds require API_BASE_URL through --dart-define.',
      );

  final String value;
  final bool isRelease;
}

const configuredApiBaseUrl = _ReleaseApiUrlRequirement(
  String.fromEnvironment('API_BASE_URL'),
  isRelease: bool.fromEnvironment('dart.vm.product'),
);

/// Validates the compile-time API URL without echoing it in thrown errors.
///
/// Release builds must explicitly provide an HTTPS URL. Non-release builds
/// must explicitly provide a non-production URL; plain HTTP is restricted to
/// local/emulator addresses.
String resolveApiBaseUrl(String configuredUrl, {required bool isRelease}) {
  final value = configuredUrl.trim();
  if (value.isEmpty) {
    throw const FormatException(
      'API_BASE_URL is required. Supply it with --dart-define=API_BASE_URL=... .',
    );
  }

  final uri = Uri.tryParse(value);
  if (uri == null ||
      !uri.hasScheme ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/')) {
    throw const FormatException(
      'API_BASE_URL must be an HTTP(S) API origin without credentials, path, query, or fragment.',
    );
  }

  final scheme = uri.scheme.toLowerCase();
  final host = uri.host.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
  if (scheme != 'https' && scheme != 'http') {
    throw const FormatException('API_BASE_URL must use HTTP or HTTPS.');
  }
  if (isRelease && scheme != 'https') {
    throw const FormatException('Release API_BASE_URL must use HTTPS.');
  }
  if (!isRelease && _knownProductionHosts.contains(host)) {
    throw const FormatException(
      'Non-release builds cannot use the production API host.',
    );
  }
  if (!isRelease &&
      !_localHosts.contains(host) &&
      !host
          .split(RegExp(r'[.-]'))
          .any(_developmentHostLabels.contains)) {
    throw const FormatException(
      'Non-release HTTPS API_BASE_URL must use a development, test, staging, or sandbox host.',
    );
  }
  if (!isRelease && scheme == 'http' && !_localHosts.contains(host)) {
    throw const FormatException(
      'Non-release HTTP API_BASE_URL is allowed only for local or emulator hosts.',
    );
  }

  return uri.replace(path: '').toString().replaceFirst(RegExp(r'/$'), '');
}
