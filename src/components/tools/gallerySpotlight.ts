export function init(): void {
  const uploadArea     = document.getElementById('uploadArea');
  const uploadInput    = document.getElementById('artworkUpload')    as HTMLInputElement   | null;
  const placeholder    = document.getElementById('uploadPlaceholder');
  const preview        = document.getElementById('uploadedPreview')  as HTMLImageElement   | null;
  const lightBtn       = document.getElementById('galleryLightBtn');
  const gallerySection = document.querySelector('[data-your-artwork-section]');

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!preview || !placeholder) return;
      preview.src = e.target?.result as string;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      uploadArea?.setAttribute('data-has-image', '');
    };
    reader.readAsDataURL(file);
  }

  uploadInput?.addEventListener('change', () => {
    const file = uploadInput.files?.[0];
    if (file) handleFile(file);
  });

  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.setAttribute('data-drag-over', '');
  });
  uploadArea?.addEventListener('dragleave', () => uploadArea.removeAttribute('data-drag-over'));
  uploadArea?.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    uploadArea.removeAttribute('data-drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  });

  lightBtn?.addEventListener('click', () => {
    if (gallerySection?.hasAttribute('data-spotlight')) {
      gallerySection.removeAttribute('data-spotlight');
    } else {
      gallerySection?.setAttribute('data-spotlight', '');
    }
  });
}
