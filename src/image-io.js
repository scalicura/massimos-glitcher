const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Validate and decode an uploaded image without modifying its underlying File.
 * The returned ImageBitmap (or HTMLImageElement fallback) is kept as the immutable
 * source for every preview and export render.
 */
export async function loadImageFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Choose an image file to continue.');
  }

  const hasSupportedType = SUPPORTED_TYPES.has(file.type);
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.test(file.name);
  if (!hasSupportedType || !hasSupportedExtension) {
    throw new Error('Unsupported file. Please use a JPG, PNG, or WebP image.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('That image is larger than 25 MB. Choose a smaller file.');
  }

  let source;
  try {
    source = await decodeImage(file);
  } catch {
    throw new Error('The image could not be decoded. It may be damaged.');
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  if (!width || !height) {
    closeImageSource(source);
    throw new Error('The image could not be decoded. It may be damaged.');
  }

  return { source, width, height, name: file.name, size: file.size };
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some browsers reject options they do not support; retry via <img> below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function closeImageSource(source) {
  if (source && typeof source.close === 'function') source.close();
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
