let imageBase64:    string | null = null;
let imageMediaType: string | null = null;

export function getImageBase64():    string | null { return imageBase64; }
export function getImageMediaType(): string | null { return imageMediaType; }

function handleImageFile(file: File, onValidate: () => void): void {
  if (!file.type.startsWith('image/')) return;
  const uploadPreview     = document.getElementById('gd-image-preview')      as HTMLImageElement | null;
  const uploadPlaceholder = document.getElementById('gd-upload-placeholder');
  const uploadPreviewWrap = document.getElementById('gd-upload-preview-wrap');
  const uploadZone        = document.getElementById('gd-upload-zone');

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const comma = dataUrl.indexOf(',');
    imageBase64    = dataUrl.slice(comma + 1);
    imageMediaType = dataUrl.slice(5, comma).replace(';base64', '');
    if (uploadPreview)     uploadPreview.src                = dataUrl;
    if (uploadPlaceholder) uploadPlaceholder.style.display  = 'none';
    if (uploadPreviewWrap) uploadPreviewWrap.style.display  = '';
    uploadZone?.setAttribute('data-has-image', '');
    onValidate();
  };
  reader.readAsDataURL(file);
}

function clearImage(onValidate: () => void): void {
  const uploadInput       = document.getElementById('gd-image-upload')       as HTMLInputElement | null;
  const uploadPreview     = document.getElementById('gd-image-preview')      as HTMLImageElement | null;
  const uploadPreviewWrap = document.getElementById('gd-upload-preview-wrap');
  const uploadPlaceholder = document.getElementById('gd-upload-placeholder');
  const uploadZone        = document.getElementById('gd-upload-zone');

  imageBase64 = imageMediaType = null;
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
