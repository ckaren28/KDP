export function buildUrl(
  publicId: string,
  options: { w?: number; h?: number; fit?: string; format?: string; quality?: string } = {}
) {
  const { w, h, fit = 'fill', format = 'auto', quality = 'auto' } = options;
  const transforms = [
    `f_${format}`,
    `q_${quality}`,
    w && `w_${w}`,
    h && `h_${h}`,
    (w || h) && `c_${fit}`,
  ].filter(Boolean).join(',');
  return `https://res.cloudinary.com/deqij2maw/image/upload/${transforms}/${publicId}`;
}
