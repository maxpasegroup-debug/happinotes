import 'dotenv/config';

const REQUIRED_PRODUCTION_ORIGIN = 'https://happinotes.online';
const DEVELOPMENT_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:3001',
];

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export type CorsConfiguration = {
  allowedOrigins: string[];
  httpOptions: {
    origin: (origin: string | undefined, callback: CorsOriginCallback) => void;
    methods: string[];
    credentials: true;
  };
  socketIoOptions: {
    origin: string[];
    methods: string[];
    credentials: true;
  };
};

function parseConfiguredOrigins(rawOrigins: string | undefined, isProduction: boolean): string[] {
  const raw = rawOrigins?.trim() ?? '';
  if (!raw) {
    if (isProduction) {
      throw new Error('CORS_ORIGINS is required in production and must include https://happinotes.online.');
    }
    return [];
  }

  const entries = raw.split(',').map((origin) => origin.trim());
  if (entries.some((origin) => !origin)) {
    throw new Error('CORS_ORIGINS must be a comma-separated list of canonical browser origins.');
  }

  for (const origin of entries) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS must contain only valid canonical browser origins.');
    }

    if (
      parsed.origin !== origin ||
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      (isProduction && parsed.protocol !== 'https:')
    ) {
      throw new Error('CORS_ORIGINS must contain canonical origins without paths; production origins must use HTTPS.');
    }
  }

  return [...new Set(entries)];
}

export function buildCorsConfiguration(
  nodeEnv: string | undefined,
  rawOrigins: string | undefined,
): CorsConfiguration {
  const isProduction = nodeEnv === 'production';
  const configuredOrigins = parseConfiguredOrigins(rawOrigins, isProduction);
  if (isProduction && !configuredOrigins.includes(REQUIRED_PRODUCTION_ORIGIN)) {
    throw new Error('CORS_ORIGINS must include the required production origin https://happinotes.online.');
  }

  const allowedOrigins = isProduction
    ? configuredOrigins
    : [...new Set([...DEVELOPMENT_ORIGINS, ...configuredOrigins])];
  const allowedOriginSet = new Set(allowedOrigins);

  return {
    allowedOrigins,
    httpOptions: {
      origin: (origin, callback) => {
        if (!origin || allowedOriginSet.has(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    socketIoOptions: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  };
}

export const corsConfiguration = buildCorsConfiguration(
  process.env.NODE_ENV || 'development',
  process.env.CORS_ORIGINS,
);
