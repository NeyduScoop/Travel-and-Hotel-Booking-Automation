/* eslint-disable no-console */
type Level = 'debug' | 'info' | 'warn' | 'error';

import { secretValues } from './environment.utils';

/** Credential values from the shared SECRET_ENV_VARS list (environment.utils has no config import, so no cycle). */
function configuredSecretValues(): string[] {
  return secretValues();
}

/** "password: x", "token=x", … — keep the key and separator, redact the value. */
const KEY_VALUE_SECRET = /(password|passwd|pwd|token|secret|otp|cvv|pin)(["'\s:=]+)([^"'\s,}|]+)/gi;
/** Card-number shaped values: 15–19 digits (13-digit Wakanow booking ids are deliberately not matched). */
const CARD_NUMBER = /\b\d{15,19}\b/g;

/** Redact secret-looking values (and every configured credential) from a message before it is logged or attached. */
export function redact(message: string): string {
  let out = message;
  for (const secret of configuredSecretValues()) out = out.split(secret).join('<redacted>');
  out = out.replace(KEY_VALUE_SECRET, (_m, key: string, sep: string) => `${key}${sep}<redacted>`);
  out = out.replace(CARD_NUMBER, '<redacted>');
  return out;
}

function write(level: Level, scope: string, message: string): void {
  if (level === 'debug' && !process.env.DEBUG_LOGS) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${redact(message)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string) => write('debug', scope, msg),
    info: (msg: string) => write('info', scope, msg),
    warn: (msg: string) => write('warn', scope, msg),
    error: (msg: string) => write('error', scope, msg),
  };
}

export type Logger = ReturnType<typeof createLogger>;
