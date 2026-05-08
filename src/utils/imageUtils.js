/**
 * Compresses an image file by resizing it to a maximum width/height 
 * and converting to JPEG with adjustable quality.
 * @param {File} file - The original image file.
 * @param {number} maxWidth - Maximum allowed width (default 1920).
 * @param {number} maxHeight - Maximum allowed height (default 1920).
 * @param {number} quality - JPEG quality 0–1 (default 0.85).
 * @returns {Promise<Blob>} Compressed image blob.
 */
export function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // Not an image – return the original file
      return resolve(file);
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      // Only resize if image exceeds max dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = (height / width) * maxWidth;
          width = maxWidth;
        } else {
          width = (width / height) * maxHeight;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
