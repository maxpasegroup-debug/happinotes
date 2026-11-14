import { isIP } from 'net';
import { BadRequestError } from '../utils/errors';
import { clean } from './userNetwork';

export const DEVICE_REFERENCE_VERSION = 1;
export const deviceModelKey = (model: string) => model.trim().toLowerCase().replace(/\s+/g, ' ');
const reasons = new Set(['model_missing', 'model_unsupported', 'no_catalog_match', 'ambiguous_match', 'no_catalog_photo', 'image_metadata_unavailable', 'catalog_unavailable', 'busy']);
const textFields = ['matchedModel', 'resolvedModel', 'author', 'license', 'sourceLabel', 'searchTitle'] as const;
const urlFields = ['imageUrl', 'thumbnailUrl', 'sourceUrl', 'modelSourceUrl', 'modelMappingUrl', 'licenseUrl'] as const;
export function referenceTtl(status: unknown) {
  return status === 'found' ? 7 * 86400000 : status === 'not_found' ? 3600000 : 60000;
}
export function validateDeviceReference(value: unknown, model: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 16000) throw new BadRequestError('Invalid device reference.');
  const input = value as Record<string, unknown>;
  if (!['found', 'not_found', 'unavailable'].includes(String(input.status)) || typeof input.model !== 'string' || deviceModelKey(input.model) !== deviceModelKey(model)) throw new BadRequestError('Device model does not match the saved report.');
  const photo: Record<string, unknown> = { model, status: input.status };
  for (const field of textFields) if (typeof input[field] === 'string') photo[field] = clean(input[field], 300);
  for (const field of urlFields) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string' || input[field].length > 4096) throw new BadRequestError('Invalid reference URL.');
    try {
      const url = new URL(input[field]);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname) || url.hostname.startsWith('[') || !url.hostname.includes('.') || /\.(local|localhost|internal|test|invalid|example)$/.test(url.hostname)) throw new Error('URL');
      photo[field] = url.href;
    } catch { throw new BadRequestError('Invalid reference URL.'); }
  }
  if (input.provider === 'serper') photo.provider = 'serper';
  if (typeof input.sharedModelCode === 'boolean') photo.sharedModelCode = input.sharedModelCode;
  if (typeof input.reason === 'string' && reasons.has(input.reason)) photo.reason = input.reason;
  if (photo.status === 'found' && (!photo.imageUrl || !photo.sourceUrl || !photo.modelSourceUrl)) throw new BadRequestError('Device reference is missing its image or source.');
  return photo;
}
