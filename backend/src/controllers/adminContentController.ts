import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Content } from '../models';
import type { ILifebookSection, ILesson } from '../models/Content';
import type { Multer } from 'multer';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { cloudinary } from '../config/cloudinary';

const CONTENT_UPDATE_FIELDS = [
  'title',
  'description',
  'thumbnailUrl',
  'language',
  'type',
  'contentType',
  'featured',
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

type UploadedFile = Express.Multer.File;

async function uploadToCloudinary(
  file: UploadedFile,
  folder: string
): Promise<{ url: string; resourceType: string }> {
  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          url: result.secure_url,
          resourceType: result.resource_type,
        });
      }
    );
    stream.end(file.buffer);
  });
}

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
    const contentType = normalizeContentType(body.contentType);

    if (!title) return next(new BadRequestError('title is required'));
    if (!language) return next(new BadRequestError('language is required'));
    if (!type) return next(new BadRequestError('type must be free or premium'));
    if (!contentType) {
      return next(new BadRequestError('contentType must be lifebook, note, or silence'));
    }

    const thumbnailFile = files?.thumbnail?.[0];
    const introFile = files?.introMedia?.[0];
    const conclusionFile = files?.conclusionMedia?.[0];
    const lessonFiles = files?.lessonMedia ?? [];
    const mediaFile = files?.media?.[0];

    if (!thumbnailFile) {
      return next(new BadRequestError('thumbnail file is required'));
    }
    if (contentType === 'lifebook') {
      if (!introFile) {
        return next(new BadRequestError('introMedia file is required'));
      }
      if (!conclusionFile) {
        return next(new BadRequestError('conclusionMedia file is required'));
      }
    } else if (!mediaFile) {
      return next(new BadRequestError('media file is required for note/silence'));
    }

    const thumbnailUpload = await uploadToCloudinary(
      thumbnailFile,
      'happinotes/thumbnails'
    );
    let content: unknown;
    if (contentType === 'lifebook') {
      const rawIntro =
        typeof body.intro === 'string' ? JSON.parse(body.intro) : body.intro;
      const rawConclusion =
        typeof body.conclusion === 'string' ? JSON.parse(body.conclusion) : body.conclusion;
      const rawLessons =
        typeof body.lessons === 'string'
          ? JSON.parse(body.lessons)
          : body.lessons;

      const lessonsInput = Array.isArray(rawLessons) ? rawLessons : [];
      if (lessonFiles.length !== lessonsInput.length) {
        return next(
          new BadRequestError('lessonMedia count must match number of lessons')
        );
      }

      const introUpload = await uploadToCloudinary(
        introFile as UploadedFile,
        'happinotes/intro'
      );
      const conclusionUpload = await uploadToCloudinary(
        conclusionFile as UploadedFile,
        'happinotes/conclusion'
      );

      const introMediaType = mediaTypeFromMime((introFile as UploadedFile).mimetype);
      const conclusionMediaType = mediaTypeFromMime((conclusionFile as UploadedFile).mimetype);
      if (!introMediaType || !conclusionMediaType) {
        return next(
          new BadRequestError('introMedia and conclusionMedia must be audio or video')
        );
      }

      const intro = normalizeSection({
        ...(rawIntro || {}),
        mediaUrl: introUpload.url,
        mediaType: introMediaType,
      });
      const conclusion = normalizeSection({
        ...(rawConclusion || {}),
        mediaUrl: conclusionUpload.url,
        mediaType: conclusionMediaType,
      });

      if (!intro)
        return next(
          new BadRequestError('intro is required (title, mediaUrl, mediaType)')
        );
      if (!conclusion)
        return next(
          new BadRequestError('conclusion is required (title, mediaUrl, mediaType)')
        );

      const lessons = normalizeLessons(
        lessonsInput.map((lesson, index) => {
          const file = lessonFiles[index];
          const mt = mediaTypeFromMime(file.mimetype);
          if (!mt) {
            throw new BadRequestError('lessonMedia files must be audio or video');
          }
          return {
            ...(lesson as Record<string, unknown>),
            mediaUrl: undefined,
            mediaType: mt,
          };
        })
      );

      for (let i = 0; i < lessons.length; i += 1) {
        const uploaded = await uploadToCloudinary(
          lessonFiles[i],
          'happinotes/lessons'
        );
        lessons[i].mediaUrl = uploaded.url;
      }

      content = await Content.create({
        contentType: 'lifebook',
        title,
        description: description || '',
        thumbnailUrl: thumbnailUpload.url,
        language,
        type,
        status: body.status === 'coming_soon' || body.status === 'live' ? body.status : 'draft',
        featured: body.featured === 'true' || body.featured === true,
        intro,
        lessons,
        conclusion,
      });
    } else {
      const mediaType = mediaTypeFromMime((mediaFile as UploadedFile).mimetype);
      if (!mediaType) {
        return next(new BadRequestError('media must be audio or video'));
      }
      const mediaUpload = await uploadToCloudinary(
        mediaFile as UploadedFile,
        `happinotes/${contentType}`
      );
      const category =
        typeof body.category === 'string' ? body.category.trim() : '';
      if (contentType === 'silence' && !category) {
        return next(new BadRequestError('category is required for silence'));
      }

      content = await Content.create({
        contentType,
        title,
        description: description || '',
        thumbnailUrl: thumbnailUpload.url,
        language,
        type,
        status: body.status === 'coming_soon' || body.status === 'live' ? body.status : 'draft',
        featured: body.featured === 'true' || body.featured === true,
        mediaUrl: mediaUpload.url,
        mediaType,
        category: contentType === 'silence' ? category : undefined,
      });
    }
    res.status(201).json({ success: true, content });
  } catch (err) {
    next(err);
  }
};

/** PUT /admin/contents/:id — update lifebook content; do not allow updating status */
export const updateContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const thumbnailFile = files?.thumbnail?.[0];
    const introFile = files?.introMedia?.[0];
    const conclusionFile = files?.conclusionMedia?.[0];
    const lessonFiles = files?.lessonMedia ?? [];
    const mediaFile = files?.media?.[0];

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
        'happinotes/thumbnails'
      );
      (payload as Record<string, unknown>).thumbnailUrl = uploaded.url;
    }

    if (finalContentType === 'lifebook' && (payload.intro !== undefined || introFile)) {
      const rawIntro =
        typeof body.intro === 'string' ? JSON.parse(body.intro) : body.intro;
      let introInput: Record<string, unknown> = {
        ...(existing.intro ? (existing.intro as unknown as Record<string, unknown>) : {}),
        ...(rawIntro || {}),
      };
      if (introFile) {
        const mt = mediaTypeFromMime(introFile.mimetype);
        if (!mt) {
          return next(
            new BadRequestError('introMedia file must be audio or video')
          );
        }
        const uploaded = await uploadToCloudinary(
          introFile,
          'happinotes/intro'
        );
        introInput = {
          ...introInput,
          mediaUrl: uploaded.url,
          mediaType: mt,
        };
      }
      const intro = normalizeSection(introInput);
      if (!intro)
        return next(
          new BadRequestError('intro must have title, mediaUrl, mediaType')
        );
      payload.intro = intro;
    }

    if (finalContentType === 'lifebook' && (payload.conclusion !== undefined || conclusionFile)) {
      const rawConclusion =
        typeof body.conclusion === 'string'
          ? JSON.parse(body.conclusion)
          : body.conclusion;
      let conclusionInput: Record<string, unknown> = {
        ...(existing.conclusion
          ? (existing.conclusion as unknown as Record<string, unknown>)
          : {}),
        ...(rawConclusion || {}),
      };
      if (conclusionFile) {
        const mt = mediaTypeFromMime(conclusionFile.mimetype);
        if (!mt) {
          return next(
            new BadRequestError('conclusionMedia file must be audio or video')
          );
        }
        const uploaded = await uploadToCloudinary(
          conclusionFile,
          'happinotes/conclusion'
        );
        conclusionInput = {
          ...conclusionInput,
          mediaUrl: uploaded.url,
          mediaType: mt,
        };
      }
      const conclusion = normalizeSection(conclusionInput);
      if (!conclusion)
        return next(
          new BadRequestError('conclusion must have title, mediaUrl, mediaType')
        );
      payload.conclusion = conclusion;
    }

    if (finalContentType === 'lifebook' && (payload.lessons !== undefined || lessonFiles.length > 0)) {
      const rawLessons =
        typeof body.lessons === 'string'
          ? JSON.parse(body.lessons)
          : body.lessons;
      const lessonsInput = Array.isArray(rawLessons) ? rawLessons : [];

      if (lessonFiles.length > 0 && lessonFiles.length !== lessonsInput.length) {
        return next(
          new BadRequestError('lessonMedia count must match number of lessons')
        );
      }

      const baseLessons =
        lessonsInput.length > 0
          ? lessonsInput
          : (existing.lessons as unknown as Record<string, unknown>[]);

      const normalized = normalizeLessons(
        baseLessons.map((lesson, index) => {
          const file = lessonFiles[index];
          if (!file) return lesson;
          const mt = mediaTypeFromMime(file.mimetype);
          if (!mt) {
            throw new BadRequestError('lessonMedia files must be audio or video');
          }
          return {
            ...(lesson as Record<string, unknown>),
            mediaUrl: undefined,
            mediaType: mt,
          };
        })
      );

      for (let i = 0; i < normalized.length; i += 1) {
        const file = lessonFiles[i];
        if (!file) continue;
        const uploaded = await uploadToCloudinary(
          file,
          'happinotes/lessons'
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
          return next(new BadRequestError('media file must be audio or video'));
        }
        const uploaded = await uploadToCloudinary(mediaFile, `happinotes/${finalContentType}`);
        payload.mediaUrl = uploaded.url;
        payload.mediaType = mt;
      }

      if (!payload.mediaUrl && !existing.mediaUrl) {
        return next(new BadRequestError('media is required for note/silence'));
      }

      if (finalContentType === 'silence') {
        const category =
          typeof payload.category === 'string'
            ? payload.category.trim()
            : typeof existing.category === 'string'
              ? existing.category.trim()
              : '';
        if (!category) {
          return next(new BadRequestError('category is required for silence'));
        }
        payload.category = category;
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

    const content = await Content.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!content) return next(new NotFoundError('Content not found'));
    res.json({ success: true, content });
  } catch (err) {
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
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!content) return next(new NotFoundError('Content not found'));
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
    res.json({ success: true, content });
  } catch (err) {
    next(err);
  }
};

