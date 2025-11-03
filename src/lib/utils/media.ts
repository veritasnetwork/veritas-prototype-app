/**
 * Media dimension extraction and aspect ratio utilities
 */

export interface MediaDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export type MediaDisplayMode = 'native' | 'letterbox' | 'pillarbox';

/**
 * Extract dimensions from an image file
 */
function getImageDimensions(file: File): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      resolve({
        width,
        height,
        aspectRatio: width / height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Extract dimensions from a video file
 */
function getVideoDimensions(file: File): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width === 0 || height === 0) {
        reject(new Error('Invalid video dimensions'));
        return;
      }

      resolve({
        width,
        height,
        aspectRatio: width / height,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };

    video.src = url;
  });
}

/**
 * Extract dimensions from image or video file
 */
export async function getMediaDimensions(file: File): Promise<MediaDimensions> {
  const type = file.type.split('/')[0];

  if (type === 'image') {
    return getImageDimensions(file);
  } else if (type === 'video') {
    return getVideoDimensions(file);
  } else {
    throw new Error(`Unsupported media type: ${file.type}`);
  }
}

/**
 * Determine display mode based on aspect ratio
 * - native: 9:16 to 16:9 (normal range)
 * - letterbox: wider than 16:9 (ultra-wide)
 * - pillarbox: taller than 9:16 (ultra-tall)
 */
export function getMediaDisplayMode(aspectRatio: number): MediaDisplayMode {
  const WIDE_THRESHOLD = 16 / 9;  // ~1.78
  const TALL_THRESHOLD = 9 / 16;  // ~0.56

  if (aspectRatio > WIDE_THRESHOLD) {
    return 'letterbox';
  } else if (aspectRatio < TALL_THRESHOLD) {
    return 'pillarbox';
  } else {
    return 'native';
  }
}

/**
 * Extract dimensions from a media URL (for existing media)
 */
export async function getMediaDimensionsFromUrl(url: string): Promise<MediaDimensions> {
  // Determine if it's an image or video from URL
  const ext = url.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'mov'];

  if (imageExts.includes(ext || '')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        });
      };

      img.onerror = () => reject(new Error('Failed to load image from URL'));
      img.src = url;
    });
  } else if (videoExts.includes(ext || '')) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';

      video.onloadedmetadata = () => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          reject(new Error('Invalid video dimensions'));
          return;
        }

        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
        });
      };

      video.onerror = () => reject(new Error('Failed to load video from URL'));
      video.src = url;
    });
  } else {
    throw new Error('Unknown media type from URL');
  }
}
