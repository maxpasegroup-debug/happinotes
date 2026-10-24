import { ensureBookProducts, validatePremiumPrice } from '../services/storeProductProvisioning';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Content } from '../models';
import type { ILifebookSection, ILesson } from '../models/Content';
import type { Multer } from 'multer';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors';
import { emitCatalogChanged } from '../services/realtime';
import { notifyCatalogUsers } from '../services/catalogNotification';
import { cloudinary, configureCloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { validateImageUpload, validateLessonAudioUpload, validateMediaUpload } from '../utils/mediaValidation';

const CONTENT_UPDATE_FIELDS = [
  'title',
  'description',
  'thumbnailUrl',
  'language',
  'type',
  'priceInr',
  'contentType',
  'featured',
  'webDisplayOrder',
  'mobileDisplayOrder',
  'category',
  'intro',
  'lessons',
  'conclusion',
  'mediaUrl',
  'mediaType',
] as const;

function pickContentFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CONTENT_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

function normalizeSection(v: unknown): ILifebookSection | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const description = typeof o.description === 'string' ? o.description.trim() : '';
  const mediaUrl = typeof o.mediaUrl === 'string' ? o.mediaUrl.trim() : '';
  const mediaType = o.mediaType === 'audio' || o.mediaType === 'video' ? o.mediaType : undefined;
  if (!title || !mediaUrl || !mediaType) return null;
  return { title, description, mediaUrl, mediaType };
}

function normalizeLessons(v: unknown): ILesson[] {
  if (!Array.isArray(v)) return [];
  const out: ILesson[] = [];
  v.forEach((item, index) => {
    const section = normalizeSection(item);
    if (!section) return;
    const order =
      typeof (item as Record<string, unknown>).order === 'number'
        ? ((item as Record<string, unknown>).order as number)
        : index;
    out.push({ ...section, order });
  });
  return out.sort((a, b) => a.order - b.order);
}

function normalizeDisplayOrder(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function parseJsonField(value: unknown, field: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestError(`${field} details are invalid. Please review the form and try again.`);
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function indexLessonFiles(
  files: UploadedFile[],
  rawIndexes: unknown,
  lessonCount: number,
): Map<number, UploadedFile> {
  const indexes = rawIndexes === undefined ? files.map((_file, index) => index) : parseJsonField(rawIndexes, 'Lesson file mapping');
  if (!Array.isArray(indexes) || indexes.length !== files.length || indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= lessonCount) || new Set(indexes).size !== indexes.length) {
    throw new BadRequestError('Lesson audio files could not be matched to their lesson cards. Please review the lessons and try again.');
  }
  return new Map(indexes.map((index, fileIndex) => [index as number, files[fileIndex]]));
}

type UploadedFile = Express.Multer.File;
type CloudinaryAsset = { publicId: string; resourceType: string };

async function uploadToCloudinary(
  file: UploadedFile,
  folder: string,
  cleanupAssets?: CloudinaryAsset[],
): Promise<{ url: string; resourceType: string }> {
  if (!isCloudinaryConfigured()) {
    throw new AppError('Media storage is not configured. Please contact an administrator.', 503);
  }

  configureCloudinary();
  const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'video';
  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        clearTimeout(timeout);
        if (error) {
          reject(new AppError('Media storage is temporarily unavailable. Please try again.', 503));
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new AppError('Media storage did not confirm the upload. Please try again.', 503));
          return;
        }
        resolve({
          url: result.secure_url,
          resourceType: result.resource_type || resourceType,
        });
        if (cleanupAssets && result.public_id) {
          cleanupAssets.push({ publicId: result.public_id, resourceType: result.resource_type || resourceType });
        }
      },
    );
    const timeout = setTimeout(() => {
      stream.destroy();
      reject(new AppError('Media upload timed out. Check your connection and try again.', 504));
    }, 120_000);
    stream.on('error', () => {
      clearTimeout(timeout);
      reject(new AppError('Media storage is temporarily unavailable. Please try again.', 503));
    });
    stream.end(file.buffer);
  });
}

async function cleanupCloudinaryAssets(assets: CloudinaryAsset[]): Promise<void> {
  await Promise.all(assets.map(async (asset) => {
    try {
      await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType });
    } catch {
      // Cleanup failure must not replace the original create error or log provider details.
    }
  }));
}

/** POST /admin/contents/upload-media — upload single audio/video file and return URL */
export const uploadContentMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file as UploadedFile | undefined;
    if (!file) {
      return next(new BadRequestError('media file is required'));
    }
    const mediaType = file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('audio/')
        ? 'audio'
        : file.mimetype.startsWith('video/')
          ? 'video'
          : null;
    if (!mediaType) {
      return next(new BadRequestError('Use a JPG/PNG/WebP image, MP3 audio, MP4 video, or WebM video.'));
    }

    const scope = typeof req.body?.scope === 'string' ? req.body.scope.trim() : '';
    const validationMessage = validateMediaUpload(file, scope);
    if (validationMessage) return next(new BadRequestError(validationMessage));
    const folder =
      scope === 'intro'
        ? 'happinotes/intro'
        : scope === 'conclusion'
          ? 'happinotes/conclusion'
          : scope === 'lesson'
            ? 'happinotes/lessons'
            : scope === 'note'
              ? 'happinotes/note'
          : scope === 'silence'
                ? 'happinotes/silence'
                : scope === 'notification'
                  ? 'happinotes/notifications'
                : 'happinotes/uploads';

    const uploaded = await uploadToCloudinary(file, folder);
    res.status(201).json({
      success: true,
      url: uploaded.url,
      mediaType,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/contents — return all contents regardless of status */
export const getAllContents = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const contents = await Content.find().sort({ featured: -1, createdAt: -1 }).lean();
    res.json({ success: true, contents });
  } catch (err) {
    next(err);
  }
};

function mediaTypeFromMime(mime: string | undefined): 'audio' | 'video' | null {
  if (!mime) return null;
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

function normalizeContentType(value: unknown): 'lifebook' | 'note' | 'silence' | null {
  if (value === 'lifebook' || value === 'note' || value === 'silence') return value;
  if (value === 'happiness') return 'silence';
  return null;
}

/** POST /admin/contents — create lifebook content with Cloudinary media; status = draft */
export const createContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const uploadedAssets: CloudinaryAsset[] = [];
  let contentPersisted = false;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const body = req.body as Record<string, unknown>;
    const files = req.files as
      | Record<string, UploadedFile[] | undefined>
      | undefined;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const language = typeof body.language === 'string' ? body.language.trim() : '';
    const type = body.type === 'free' || body.type === 'premium' ? body.type : undefined;
    const priceInr = Number(body.priceInr ?? 0);
    const contentType = normalizeContentType(body.contentType);
    const status = body.status === 'coming_soon' || body.status === 'live' ? body.status : 'draft';

    if (!title) return next(new BadRequestError('title is required'));
    if (!language) return next(new BadRequestError('language is required'));
    if (!type) return next(new BadRequestError('type must be free or premium'));
    if (!Number.isFinite(priceInr) || priceInr < 0) return next(new BadRequestError('priceInr must be a non-negative number'));
    // Premium books use the shared subscription plans. priceInr is legacy-only.
    if (!contentType) {
      return next(new BadRequestError('contentType must be lifebook, note, or silence'));
    }

    const thumbnailFile = files?.thumbnail?.[0];
    const introFile = files?.introMedia?.[0];
    const conclusionFile = files?.conclusionMedia?.[0];
    const lessonFiles = files?.lessonMedia ?? [];
    const mediaFile = files?.media?.[0];

    const uploadChecks: Array<[UploadedFile | undefined, string]> = [
      [thumbnailFile, 'thumbnail'], [introFile, 'intro'], [conclusionFile, 'conclusion'], [mediaFile, 'media'],
    ];
    for (const [file, scope] of uploadChecks) {
      if (!file) continue;
      const message = scope === 'thumbnail' ? validateImageUpload(file) : validateMediaUpload(file, scope);
      if (message) return next(new BadRequestError(message));
    }
    for (const file of lessonFiles) {
      const message = validateLessonAudioUpload(file);
      if (message) return next(new BadRequestError(message));
    }

    if (!thumbnailFile) {
      return next(new BadRequestError('thumbnail file is required'));
    }
    if (contentType !== 'lifebook' && status === 'live' && !mediaFile) {
      return next(new BadRequestError('media file is required for live note/silence'));
    }

    const rawIntro = parseJsonField(body.intro, 'Introduction');
    const rawConclusion = parseJsonField(body.conclusion, 'Conclusion');
    const rawLessons = parseJsonField(body.lessons, 'Lesson');
    const lessonsInput = Array.isArray(rawLessons) ? rawLessons : [];
    const lessonFileByIndex = indexLessonFiles(lessonFiles, body.lessonMediaIndexes, lessonsInput.length);
    const submittedLessons = lessonsInput as Record<string, unknown>[];
    for (let index = 0; index < submittedLessons.length; index += 1) {
      const lesson = submittedLessons[index];
      if (typeof lesson?.title !== 'string' || !lesson.title.trim()) {
        return next(new BadRequestError(`Lesson ${index + 1}: enter a lesson name.`));
      }
      if (!lessonFileByIndex.has(index) && (typeof lesson.mediaUrl !== 'string' || !lesson.mediaUrl.trim())) {
        return next(new BadRequestError(`Lesson ${index + 1}: add an MP3 audio file.`));
      }
      if (!lessonFileByIndex.has(index) && lesson.mediaType !== 'audio' && lesson.mediaType !== 'video') {
        return next(new BadRequestError(`Lesson ${index + 1}: choose a supported audio file.`));
      }
    }
    if (contentType === 'lifebook' && status === 'live' && lessonsInput.length === 0) {
      return next(new BadRequestError('Add at least one lesson with an MP3 file before publishing.'));
    }
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (contentType === 'silence' && status === 'live' && !category) {
      return next(new BadRequestError('category is required for live silence'));
    }

    const thumbnailUpload = await uploadToCloudinary(
      thumbnailFile,
      'happinotes/thumbnails',
      uploadedAssets,
    );
    let content: unknown;
    if (contentType === 'lifebook') {
      let intro: ILifebookSection | undefined;
      if (introFile) {
        const introMediaType = mediaTypeFromMime(introFile.mimetype);
        if (!introMediaType) {
          throw new BadRequestError('Introduction media must use a supported format.');
        }
        const introUpload = await uploadToCloudinary(introFile, 'happinotes/intro', uploadedAssets);
        intro = normalizeSection({
          ...recordValue(rawIntro),
          title:
            typeof (rawIntro as Record<string, unknown> | undefined)?.title === 'string'
              ? (rawIntro as Record<string, unknown>).title
              : 'Introduction',
          mediaUrl: introUpload.url,
          mediaType: introMediaType,
        }) || undefined;
      } else {
        intro = normalizeSection(rawIntro) || undefined;
      }

      let conclusion: ILifebookSection | undefined;
      if (conclusionFile) {
        const conclusionMediaType = mediaTypeFromMime(conclusionFile.mimetype);
        if (!conclusionMediaType) {
          return next(new BadRequestError('conclusionMedia must be audio or video'));
        }
        const conclusionUpload = await uploadToCloudinary(
          conclusionFile,
          'happinotes/conclusion',
          uploadedAssets,
        );
        conclusion = normalizeSection({
          ...recordValue(rawConclusion),
          title:
            typeof (rawConclusion as Record<string, unknown> | undefined)?.title === 'string'
              ? (rawConclusion as Record<string, unknown>).title
              : 'Conclusion',
          mediaUrl: conclusionUpload.url,
          mediaType: conclusionMediaType,
        }) || undefined;
      } else {
        conclusion = normalizeSection(rawConclusion) || undefined;
      }

      const lessonsWithMedia = normalizeLessons(
        lessonsInput.map((lesson, index) => {
          const file = lessonFileByIndex.get(index);
          if (!file) {
            return lesson as Record<string, unknown>;
          }
          const mt = mediaTypeFromMime(file.mimetype);
          if (!mt) throw new BadRequestError('lessonMedia files must be audio or video');
          return {
            ...(lesson as Record<string, unknown>),
            mediaUrl: 'pending-upload',
            mediaType: mt,
          };
        })
      );
      if (lessonsWithMedia.length !== lessonsInput.length) {
        throw new BadRequestError('Every lesson needs a name and an MP3 file.');
      }

      for (let i = 0; i < lessonsWithMedia.length; i += 1) {
        const file = lessonFileByIndex.get(i);
        if (!file) continue;
        const uploaded = await uploadToCloudinary(file, 'happinotes/lessons', uploadedAssets);
        lessonsWithMedia[i].mediaUrl = uploaded.url;
      }

      const createPayload: Record<string, unknown> = {
        contentType: 'lifebook',
        title,
        description: description || '',
        thumbnailUrl: thumbnailUpload.url,
        language,
        type,
        priceInr,
        status,
        featured: body.featured === 'true' || body.featured === true,
        webDisplayOrder: normalizeDisplayOrder(body.webDisplayOrder),
        mobileDisplayOrder: normalizeDisplayOrder(body.mobileDisplayOrder),
      };
      if (intro) createPayload.intro = intro;
      if (lessonsWithMedia.length > 0) createPayload.lessons = lessonsWithMedia;
      if (conclusion) createPayload.conclusion = conclusion;

      content = await Content.create({
        ...createPayload,
      });
      contentPersisted = true;
    } else {
      let mediaUpload: { url: string } | undefined;
      let mediaType: 'audio' | 'video' | undefined;
      if (mediaFile) {
        mediaType = mediaTypeFromMime((mediaFile as UploadedFile).mimetype) || undefined;
        if (!mediaType) {
          throw new BadRequestError('Content media must use a supported format.');
        }
        mediaUpload = await uploadToCloudinary(
          mediaFile as UploadedFile,
          `happinotes/${contentType}`,
          uploadedAssets,
        );
      }
      content = await Content.create({
        contentType,
        title,
        description: description || '',
        thumbnailUrl: thumbnailUpload.url,
        language,
        type,
        priceInr,
        status,
        featured: body.featured === 'true' || body.featured === true,
        webDisplayOrder: normalizeDisplayOrder(body.webDisplayOrder),
        mobileDisplayOrder: normalizeDisplayOrder(body.mobileDisplayOrder),
        mediaUrl: mediaUpload?.url,
        mediaType,
        category: contentType === 'silence' ? category || 'General' : undefined,
      });
      contentPersisted = true;
    }
    await ensureBookProducts(content as { id: string; contentType: string; type: string; priceInr: number });
    const createdContent = content as { id: string; contentType?: string };
    emitCatalogChanged('created', createdContent.id, createdContent.contentType);
    const created = content as {
      id: string;
      contentType?: string;
      status?: string;
      title?: string;
      thumbnailUrl?: string;
    };
    if (
      created.contentType === 'lifebook' &&
      (created.status === 'live' || created.status === 'coming_soon')
    ) {
      const comingSoon = created.status === 'coming_soon';
      void notifyCatalogUsers({
        eventType: 'new_book',
        bookId: created.id,
        title: comingSoon ? 'New story coming soon' : 'New story book available',
        message: comingSoon
          ? `${created.title || 'A new story book'} is coming soon. Stay tuned!`
          : `${created.title || 'A new story book'} is now available to listen.`,
        imageUrl: created.thumbnailUrl,
        baseUrl: `${req.protocol}://${req.get('host')}`,
      });
    }
    res.status(201).json({ success: true, content });
  } catch (err) {
    if (!contentPersisted) await cleanupCloudinaryAssets(uploadedAssets);
    next(err);
  }
};

/** PUT /admin/contents/:id — update lifebook content; do not allow updating status */
export const updateContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const uploadedAssets: CloudinaryAsset[] = [];
  let contentPersisted = false;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const body = req.body as Record<string, unknown>;
    const files = req.files as
      | Record<string, UploadedFile[] | undefined>
      | undefined;

    const payload = pickContentFields(body);
    const existing = await Content.findById(req.params.id);
    if (!existing) return next(new NotFoundError('Content not found'));
    const previousLessonCount = Array.isArray(existing.lessons)
      ? existing.lessons.length
      : 0;

    const thumbnailFile = files?.thumbnail?.[0];
    const introFile = files?.introMedia?.[0];
    const conclusionFile = files?.conclusionMedia?.[0];
    const lessonFiles = files?.lessonMedia ?? [];
    const mediaFile = files?.media?.[0];

    for (const [file, scope] of [[thumbnailFile, 'thumbnail'], [introFile, 'intro'], [conclusionFile, 'conclusion'], [mediaFile, 'media']] as const) {
      if (!file) continue;
      const message = scope === 'thumbnail' ? validateImageUpload(file) : validateMediaUpload(file, scope);
      if (message) return next(new BadRequestError(message));
    }
    for (const file of lessonFiles) {
      const message = validateLessonAudioUpload(file);
      if (message) return next(new BadRequestError(message));
    }

    const rawIntroValue = payload.intro !== undefined ? parseJsonField(body.intro, 'Introduction') : undefined;
    const rawConclusionValue = payload.conclusion !== undefined ? parseJsonField(body.conclusion, 'Conclusion') : undefined;
    const rawLessonsValue = payload.lessons !== undefined ? parseJsonField(body.lessons, 'Lesson') : undefined;
    const lessonsInput = Array.isArray(rawLessonsValue) ? rawLessonsValue as Record<string, unknown>[] : [];
    const lessonFileByIndex = indexLessonFiles(lessonFiles, body.lessonMediaIndexes, lessonsInput.length);
    if (payload.lessons !== undefined) {
      for (let index = 0; index < lessonsInput.length; index += 1) {
        const lesson = lessonsInput[index];
        if (typeof lesson?.title !== 'string' || !lesson.title.trim()) return next(new BadRequestError(`Lesson ${index + 1}: enter a lesson name.`));
        if (!lessonFileByIndex.has(index) && (typeof lesson.mediaUrl !== 'string' || !lesson.mediaUrl.trim())) return next(new BadRequestError(`Lesson ${index + 1}: add an MP3 audio file.`));
        if (!lessonFileByIndex.has(index) && lesson.mediaType !== 'audio' && lesson.mediaType !== 'video') return next(new BadRequestError(`Lesson ${index + 1}: choose supported audio.`));
      }
    }

    const requestedType = normalizeContentType(payload.contentType);
    if (payload.contentType !== undefined && !requestedType) {
      return next(new BadRequestError('contentType must be lifebook, note, or silence'));
    }
    const finalContentType = requestedType || normalizeContentType(existing.contentType) || 'lifebook';
    if (payload.featured !== undefined) {
      payload.featured = payload.featured === true || payload.featured === 'true';
    }

    if (thumbnailFile) {
      const uploaded = await uploadToCloudinary(
        thumbnailFile,
        'happinotes/thumbnails',
        uploadedAssets,
      );
      (payload as Record<string, unknown>).thumbnailUrl = uploaded.url;
    }

    if (finalContentType === 'lifebook' && (payload.intro !== undefined || introFile)) {
      const rawIntro = rawIntroValue;
      let introInput: Record<string, unknown> = {
        ...(existing.intro ? (existing.intro as unknown as Record<string, unknown>) : {}),
        ...recordValue(rawIntro),
      };
      if (introFile) {
        const mt = mediaTypeFromMime(introFile.mimetype);
        if (!mt) {
          throw new BadRequestError('Introduction media must use a supported format.');
        }
        const uploaded = await uploadToCloudinary(
          introFile,
          'happinotes/intro',
          uploadedAssets,
        );
        introInput = {
          ...introInput,
          mediaUrl: uploaded.url,
          mediaType: mt,
        };
      }
      const intro = normalizeSection(introInput);
      if (intro) {
        payload.intro = intro;
      } else {
        delete payload.intro;
      }
    }

    if (finalContentType === 'lifebook' && (payload.conclusion !== undefined || conclusionFile)) {
      const rawConclusion = rawConclusionValue;
      let conclusionInput: Record<string, unknown> = {
        ...(existing.conclusion
          ? (existing.conclusion as unknown as Record<string, unknown>)
          : {}),
        ...recordValue(rawConclusion),
      };
      if (conclusionFile) {
        const mt = mediaTypeFromMime(conclusionFile.mimetype);
        if (!mt) {
          throw new BadRequestError('Conclusion media must use a supported format.');
        }
        const uploaded = await uploadToCloudinary(
          conclusionFile,
          'happinotes/conclusion',
          uploadedAssets,
        );
        conclusionInput = {
          ...conclusionInput,
          mediaUrl: uploaded.url,
          mediaType: mt,
        };
      }
      const conclusion = normalizeSection(conclusionInput);
      if (conclusion) {
        payload.conclusion = conclusion;
      } else {
        delete payload.conclusion;
      }
    }

    if (finalContentType === 'lifebook' && (payload.lessons !== undefined || lessonFiles.length > 0)) {
      const lessonsInput = Array.isArray(rawLessonsValue) ? rawLessonsValue as Record<string, unknown>[] : [];

      const baseLessons = lessonsInput;

      const normalized = normalizeLessons(
        baseLessons.map((lesson, index) => {
          const file = lessonFileByIndex.get(index);
          if (!file) return lesson;
          const mt = mediaTypeFromMime(file.mimetype);
          if (!mt) {
            throw new BadRequestError('lessonMedia files must be audio or video');
          }
          return {
            ...(lesson as Record<string, unknown>),
            mediaUrl: 'pending-upload',
            mediaType: mt,
          };
        })
      );
      if (normalized.length !== lessonsInput.length) {
        throw new BadRequestError('Every lesson needs a name and an MP3 file.');
      }

      for (let i = 0; i < normalized.length; i += 1) {
        const file = lessonFileByIndex.get(i);
        if (!file) continue;
        const uploaded = await uploadToCloudinary(
          file,
          'happinotes/lessons',
          uploadedAssets,
        );
        normalized[i].mediaUrl = uploaded.url;
      }

      payload.lessons = normalized;
    }

    if (finalContentType !== 'lifebook') {
      delete payload.intro;
      delete payload.lessons;
      delete payload.conclusion;
      payload.contentType = finalContentType;

      if (mediaFile) {
        const mt = mediaTypeFromMime(mediaFile.mimetype);
        if (!mt) {
          throw new BadRequestError('Content media must use a supported format.');
        }
        const uploaded = await uploadToCloudinary(mediaFile, `happinotes/${finalContentType}`, uploadedAssets);
        payload.mediaUrl = uploaded.url;
        payload.mediaType = mt;
      }

      const currentStatus = existing.status;
      if (currentStatus === 'live' && !payload.mediaUrl && !existing.mediaUrl) {
        throw new BadRequestError('Add supported media before saving this live content.');
      }

      if (finalContentType === 'silence') {
        const category =
          typeof payload.category === 'string'
            ? payload.category.trim()
            : typeof existing.category === 'string'
              ? existing.category.trim()
              : '';
        if (currentStatus === 'live' && !category) {
          throw new BadRequestError('Add a category before saving this live content.');
        }
        payload.category = category || 'General';
      } else if (Object.prototype.hasOwnProperty.call(payload, 'category')) {
        delete payload.category;
      }
    } else {
      payload.contentType = 'lifebook';
      delete payload.mediaUrl;
      delete payload.mediaType;
      delete payload.category;
    }

    if (
      Object.keys(payload).length === 0 &&
      !thumbnailFile &&
      !introFile &&
      !conclusionFile &&
      lessonFiles.length === 0 &&
      !mediaFile
    ) {
      res.json({ success: true, content: existing });
      return;
    }

    validatePremiumPrice({ contentType: String(payload.contentType ?? existing.contentType), type: String(payload.type ?? existing.type), priceInr: Number(payload.priceInr ?? existing.priceInr) });
    const content = await Content.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!content) throw new NotFoundError('Content not found');
    contentPersisted = true;
    await ensureBookProducts(content);
    emitCatalogChanged('updated', content.id, content.contentType);
    const lessonsAdded =
      finalContentType === 'lifebook' &&
      Array.isArray(payload.lessons) &&
      payload.lessons.length > previousLessonCount;
    if (lessonsAdded && content.status === 'live') {
      void notifyCatalogUsers({
        eventType: 'new_episode',
        bookId: content.id,
        title: 'New episode available',
        message: `A new episode of “${content.title}” is now ready to listen.`,
        imageUrl: content.thumbnailUrl,
        baseUrl: `${req.protocol}://${req.get('host')}`,
      });
    }
    res.json({ success: true, content });
  } catch (err) {
    if (!contentPersisted) await cleanupCloudinaryAssets(uploadedAssets);
    next(err);
  }
};

/** DELETE /admin/contents/:id */
export const deleteContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const content = await Content.findByIdAndDelete(req.params.id);
    if (!content) return next(new NotFoundError('Content not found'));
    emitCatalogChanged('deleted', content.id, content.contentType);
    res.json({ success: true, message: 'Content deleted' });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/contents/:id/status — update only status */
export const updateContentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new BadRequestError(errors.array()[0].msg));
    }
    const status = req.body?.status;
    if (status !== 'draft' && status !== 'coming_soon' && status !== 'live') {
      return next(
        new BadRequestError(
          'status must be draft, coming_soon, or live'
        )
      );
    }
    const existing = await Content.findById(req.params.id);
    if (!existing) return next(new NotFoundError('Content not found'));
    if (status === 'live') {
      if (existing.contentType === 'lifebook' && (!Array.isArray(existing.lessons) || existing.lessons.length === 0 || existing.lessons.some((lesson) => !lesson.title?.trim() || !lesson.mediaUrl?.trim() || (lesson.mediaType !== 'audio' && lesson.mediaType !== 'video')))) {
        return next(new BadRequestError('Add at least one complete MP3 lesson before publishing this book.'));
      }
      if (existing.contentType !== 'lifebook' && (!existing.mediaUrl?.trim() || !existing.mediaType)) {
        return next(new BadRequestError('Add supported media before publishing this content.'));
      }
    }
    const wasLive = existing.status === 'live';
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!content) return next(new NotFoundError('Content not found'));
    emitCatalogChanged('updated', content.id, content.contentType);
    if (content.contentType === 'lifebook' && !wasLive && status === 'live') {
      void notifyCatalogUsers({
        eventType: 'new_book',
        bookId: content.id,
        title: 'New story book available',
        message: `${content.title} is now available to listen.`,
        imageUrl: content.thumbnailUrl,
        baseUrl: `${req.protocol}://${req.get('host')}`,
      });
    }
    res.json({ success: true, content });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/contents/:id/feature */
export const featureContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      { featured: true },
      { new: true, runValidators: true }
    );
    if (!content) return next(new NotFoundError('Content not found'));
    emitCatalogChanged('updated', content.id, content.contentType);
    res.json({ success: true, content });
  } catch (err) {
    next(err);
  }
};

/** PATCH /admin/contents/:id/unfeature */
export const unfeatureContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      { featured: false },
      { new: true, runValidators: true }
    );
    if (!content) return next(new NotFoundError('Content not found'));
    emitCatalogChanged('updated', content.id, content.contentType);
    res.json({ success: true, content });
  } catch (err) {
    next(err);
  }
};

