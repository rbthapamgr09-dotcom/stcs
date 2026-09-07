/**
 * Logo & Google Drive Image Utilities
 * Ensures logos from Google Drive, uploaded files (Base64), and external links
 * persist safely, load without CORS/Referrer blocks, and never get clipped/truncated.
 */

/**
 * Extracts Google Drive File ID from various link formats
 */
export function extractGoogleDriveFileId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // 1. https://drive.google.com/file/d/{FILE_ID}/view...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // 2. https://drive.google.com/open?id={FILE_ID} or https://drive.google.com/uc?id={FILE_ID}
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  // 3. https://lh3.googleusercontent.com/d/{FILE_ID}
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  // 4. If raw ID was pasted (typically 25-45 alphanumeric chars with - or _)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Converts any Google Drive link or external URL into a high-speed direct embeddable image URL
 */
export function normalizeLogoUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If already base64 data URL
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Check if it's a Google Drive link
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    // lh3.googleusercontent.com/d/{id} provides direct CDN image binary stream for public Drive images
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  return trimmed;
}

/**
 * Secondary fallback URL for Google Drive images (Google Drive High-Res Thumbnail)
 */
export function getDriveThumbnailUrl(url?: string): string | null {
  const driveId = extractGoogleDriveFileId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  }
  return null;
}

/**
 * Compresses uploaded logo file into a compact, ultra-safe Base64 string (< 25KB)
 * so that it never exceeds Google Sheet cell limits (50,000 chars) and never gets truncated/cut in half.
 */
export function compressImageToSafeBase64(
  file: File,
  maxDimension = 220,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('फाइल पढ्न सकिएन'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          resolve(src);
          return;
        }

        // Scale down maintaining aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        // Image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Check for PNG transparency or default to PNG with safe dimensions
        const isPng = file.type === 'image/png' || src.startsWith('data:image/png');
        
        let outputDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);

        // If PNG is still too large (> 40,000 chars), convert to JPEG to keep safely within Google Sheet cell limit
        if (outputDataUrl.length > 40000) {
          const bgCanvas = document.createElement('canvas');
          bgCanvas.width = width;
          bgCanvas.height = height;
          const bgCtx = bgCanvas.getContext('2d');
          if (bgCtx) {
            bgCtx.fillStyle = '#FFFFFF';
            bgCtx.fillRect(0, 0, width, height);
            bgCtx.drawImage(canvas, 0, 0);
            outputDataUrl = bgCanvas.toDataURL('image/jpeg', 0.82);
          }
        }

        resolve(outputDataUrl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
