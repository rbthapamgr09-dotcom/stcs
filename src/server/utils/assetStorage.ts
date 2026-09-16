/**
 * Asset storage helper to handle base64 logos and signatures (>200KB)
 * Prevents Firestore document 1MB limit violations
 */

import fs from 'fs';
import path from 'path';
import { getStorage } from 'firebase-admin/storage';

export async function optimizeAssetUrl(
  orgId: string,
  assetType: 'logo' | 'signature',
  urlOrBase64?: string
): Promise<string> {
  if (!urlOrBase64 || typeof urlOrBase64 !== 'string') {
    return '';
  }

  // If it's already a http(s) URL or relative URL, return as is
  if (!urlOrBase64.startsWith('data:image/')) {
    return urlOrBase64;
  }

  const byteLength = Buffer.byteLength(urlOrBase64, 'utf8');
  // If under 200KB, it's safe to keep in Firestore
  if (byteLength <= 200 * 1024) {
    return urlOrBase64;
  }

  console.log(`[AssetStorage] Optimizing large ${assetType} (${Math.round(byteLength / 1024)} KB) for org ${orgId}...`);

  try {
    const matches = urlOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return urlOrBase64;
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    const filename = `${assetType}_${Date.now()}.${ext}`;

    // 1. Try Firebase Storage if bucket is available
    try {
      const bucketName = 'inner-volt-dxfhk.firebasestorage.app';
      const bucket = getStorage().bucket(bucketName);
      const filePath = `offices/${orgId}/assets/${filename}`;
      const file = bucket.file(filePath);

      await file.save(buffer, {
        metadata: {
          contentType,
        },
        public: true,
      });

      // Public download URL or media link
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
      console.log(`[AssetStorage] Uploaded to Firebase Storage: ${publicUrl}`);
      return publicUrl;
    } catch (storageErr: any) {
      console.warn('[AssetStorage] Firebase Storage direct upload failed, saving to local public upload:', storageErr?.message || storageErr);
    }

    // 2. Fallback to public/uploads directory (served by static server / Vite)
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, `${orgId}_${filename}`);
    fs.writeFileSync(localFilePath, buffer);
    const relativeUrl = `/uploads/${orgId}_${filename}`;
    console.log(`[AssetStorage] Saved locally to ${relativeUrl}`);
    return relativeUrl;
  } catch (err: any) {
    console.warn(`[AssetStorage] Could not offload large ${assetType}, keeping original:`, err?.message || err);
    return urlOrBase64;
  }
}
