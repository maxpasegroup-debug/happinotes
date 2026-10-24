import 'package:flutter_test/flutter_test.dart';
import 'package:happinotes_flutter/core/network/api_config.dart';

void main() {
  test('missing API configuration is rejected', () {
    expect(
      () => resolveApiBaseUrl('', isRelease: false),
      throwsA(isA<FormatException>()),
    );
  });

  test('malformed or credential-bearing API URLs are rejected', () {
    for (final value in [
      'not a url',
      'file:///tmp/api',
      'https://user:password@example.test',
      'https://api.example.test/path',
      'https://api.example.test?key=value',
    ]) {
      expect(
        () => resolveApiBaseUrl(value, isRelease: true),
        throwsA(isA<FormatException>()),
        reason: 'Expected URL to be rejected',
      );
    }
  });

  test('invalid URL errors do not echo potentially sensitive URL contents', () {
    Object? thrown;
    try {
      resolveApiBaseUrl(
        'https://user:private-value@example.test',
        isRelease: true,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown, isA<FormatException>());
    expect(thrown.toString(), isNot(contains('private-value')));
  });

  test('development accepts explicit local and HTTPS development origins', () {
    expect(
      resolveApiBaseUrl('http://10.0.2.2:5000/', isRelease: false),
      'http://10.0.2.2:5000',
    );
    expect(
      resolveApiBaseUrl('https://api-dev.example.test', isRelease: false),
      'https://api-dev.example.test',
    );
  });

  test('development rejects the known production host and remote HTTP', () {
    expect(
      () => resolveApiBaseUrl(
        'https://happinotes-production-6b44.up.railway.app',
        isRelease: false,
      ),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => resolveApiBaseUrl('https://api.happinotes.online', isRelease: false),
      throwsA(isA<FormatException>()),
    );
    expect(
      () => resolveApiBaseUrl('http://api-dev.example.test', isRelease: false),
      throwsA(isA<FormatException>()),
    );
  });

  test('release requires explicit HTTPS and accepts a deliberate URL', () {
    expect(
      () => resolveApiBaseUrl('http://api.example.test', isRelease: true),
      throwsA(isA<FormatException>()),
    );
    expect(
      resolveApiBaseUrl('https://api.example.test', isRelease: true),
      'https://api.example.test',
    );
  });
}
