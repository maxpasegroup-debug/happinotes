/** Resolve the HTTP port without silently accepting partial or invalid numbers. */
export function resolveServerPort(value: string | undefined, nodeEnv: string): number {
  const configuredPort = value?.trim();
  if (!configuredPort) {
    if (nodeEnv === 'production') {
      throw new Error('PORT is not defined in production. Set PORT in the environment (for example, PORT=3000 locally).');
    }
    return 3000;
  }

  const port = Number(configuredPort);
  if (!/^\d+$/.test(configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}
