import { useEffect, useState } from "react";

type TrimmedImage = { src: string; trimmed: boolean };
const cache = new Map<string, TrimmedImage>();

const trimSubject = (source: string): Promise<TrimmedImage> => new Promise((resolve) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context || !canvas.width || !canvas.height) { resolve({ src: source, trimmed: false }); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const cornerPoints = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]];
      const cornerColors = cornerPoints.map(([x, y]) => { const offset = (y * canvas.width + x) * 4; return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]; });
      const background = cornerColors.reduce((sum, color) => [sum[0] + color[0] / 4, sum[1] + color[1] / 4, sum[2] + color[2] / 4], [0, 0, 0]);
      const backgroundUniform = cornerColors.every((color) => Math.max(Math.abs(color[0] - background[0]), Math.abs(color[1] - background[1]), Math.abs(color[2] - background[2])) < 24);
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const alpha = pixels[offset + 3];
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          // Transparent pixels and near-white pixels are the common exported
          // margins. Keeping the test conservative avoids trimming white
          // marquee/control details inside the actual subject.
          const closeToEdgeBackground = backgroundUniform && Math.max(Math.abs(red - background[0]), Math.abs(green - background[1]), Math.abs(blue - background[2])) < 18;
          const margin = alpha < 18 || (red > 247 && green > 247 && blue > 247) || closeToEdgeBackground;
          if (!margin) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
      }
      if (right < left || bottom < top) { resolve({ src: source, trimmed: false }); return; }
      const paddingX = Math.max(2, Math.round((right - left + 1) * 0.035));
      const paddingY = Math.max(2, Math.round((bottom - top + 1) * 0.035));
      left = Math.max(0, left - paddingX); top = Math.max(0, top - paddingY);
      right = Math.min(canvas.width - 1, right + paddingX); bottom = Math.min(canvas.height - 1, bottom + paddingY);
      const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
      if (cropWidth >= canvas.width * 0.98 && cropHeight >= canvas.height * 0.98) { resolve({ src: source, trimmed: false }); return; }
      const cropped = document.createElement("canvas");
      cropped.width = cropWidth; cropped.height = cropHeight;
      cropped.getContext("2d")?.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve({ src: cropped.toDataURL("image/webp", 0.92), trimmed: true });
    } catch {
      // A remote bucket without CORS can make a canvas unreadable. The
      // original image is still a safe, fully visible fallback.
      resolve({ src: source, trimmed: false });
    }
  };
  image.onerror = () => resolve({ src: source, trimmed: false });
  image.src = source;
});

export function SubjectThumbnail({ src, alt = "" }: { src: string; alt?: string }) {
  const [image, setImage] = useState<TrimmedImage>(() => cache.get(src) ?? { src, trimmed: false });
  useEffect(() => {
    let active = true;
    const existing = cache.get(src);
    if (existing) { setImage(existing); return () => { active = false; }; }
    void trimSubject(src).then((result) => { cache.set(src, result); if (active) setImage(result); });
    return () => { active = false; };
  }, [src]);
  return <span className={image.trimmed ? "visual-image-frame visual-image-frame--trimmed" : "visual-image-frame"}><img src={image.src} alt={alt} /></span>;
}
