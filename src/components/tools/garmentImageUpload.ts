let imageBase64:    string | null = null;
let imageMediaType: string | null = null;
let imagePreviewUrl: string | null = null;

export function getImageBase64():    string | null { return imageBase64; }
export function getImageMediaType(): string | null { return imageMediaType; }
export function getImagePreviewUrl(): string | null { return imagePreviewUrl; }

const SUPPORTED_INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OUTPUT_MEDIA_TYPE = 'image/jpeg';
const START_MAX_DIMENSION = 1400;
const START_QUALITY = 0.84;
const MAX_IMAGE_BYTES = 1_800_000;

function setUploadError(message = ''): void {
  const errEl = document.getElementById('gd-error');
  if (!errEl) return;
  errEl.textContent = message;
  errEl.style.display = message ? 'block' : 'none';
}

function imageBytesFromDataUrl(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image. Please upload a JPEG, PNG, or WebP file.'));
    };
    img.src = url;
  });
}

async function prepareImage(file: File): Promise<string> {
  const img = await loadImage(file);
  let maxDimension = START_MAX_DIMENSION;
  let quality = START_QUALITY;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process this image. Please try a different file.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL(OUTPUT_MEDIA_TYPE, quality);
    if (imageBytesFromDataUrl(dataUrl) <= MAX_IMAGE_BYTES) {
      return dataUrl;
    }

    if (quality > 0.62) {
      quality -= 0.1;
    } else {
      maxDimension *= 0.8;
    }
  }

  throw new Error('Could not process this image. Please try a smaller file.');
}

async function handleImageFile(file: File, onValidate: () => void): Promise<void> {
  setUploadError();
  if (!SUPPORTED_INPUT_TYPES.has(file.type)) {
    setUploadError('Please upload a JPEG, PNG, or WebP image.');
    return;
  }

  const uploadPreview     = document.getElementById('gd-image-preview')      as HTMLImageElement | null;
  const uploadPlaceholder = document.getElementById('gd-upload-placeholder');
  const uploadPreviewWrap = document.getElementById('gd-upload-preview-wrap');
  const uploadZone        = document.getElementById('gd-upload-zone');

  try {
    const dataUrl = await prepareImage(file);
    const comma = dataUrl.indexOf(',');
    imageBase64    = dataUrl.slice(comma + 1);
    imageMediaType = OUTPUT_MEDIA_TYPE;
    imagePreviewUrl = dataUrl;
    if (uploadPreview)     uploadPreview.src                = dataUrl;
    if (uploadPlaceholder) uploadPlaceholder.style.display  = 'none';
    if (uploadPreviewWrap) uploadPreviewWrap.style.display  = '';
    uploadZone?.setAttribute('data-has-image', '');
    onValidate();
  } catch (error) {
    imageBase64 = imageMediaType = imagePreviewUrl = null;
    onValidate();
    setUploadError((error as Error)?.message || 'Could not prepare this image. Please try another file.');
  }
}

function clearImage(onValidate: () => void): void {
  const uploadInput       = document.getElementById('gd-image-upload')       as HTMLInputElement | null;
  const uploadPreview     = document.getElementById('gd-image-preview')      as HTMLImageElement | null;
  const uploadPreviewWrap = document.getElementById('gd-upload-preview-wrap');
  const uploadPlaceholder = document.getElementById('gd-upload-placeholder');
  const uploadZone        = document.getElementById('gd-upload-zone');

  imageBase64 = imageMediaType = imagePreviewUrl = null;
  setUploadError();
  if (uploadInput)       uploadInput.value               = '';
  if (uploadPreview)     uploadPreview.src               = '';
  if (uploadPreviewWrap) uploadPreviewWrap.style.display = 'none';
  if (uploadPlaceholder) uploadPlaceholder.style.display = '';
  uploadZone?.removeAttribute('data-has-image');
  onValidate();
}

export function init(onValidate: () => void): void {
  const uploadZone   = document.getElementById('gd-upload-zone');
  const uploadInput  = document.getElementById('gd-image-upload') as HTMLInputElement | null;
  const uploadRemove = document.getElementById('gd-image-remove');

  uploadInput?.addEventListener('change', () => {
    const file = uploadInput?.files?.[0];
    if (file) handleImageFile(file, onValidate);
  });
  uploadRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage(onValidate);
  });
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.setAttribute('data-drag-over', '');
  });
  uploadZone?.addEventListener('dragleave', () => uploadZone?.removeAttribute('data-drag-over'));
  uploadZone?.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    uploadZone?.removeAttribute('data-drag-over');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) handleImageFile(file, onValidate);
  });
}
