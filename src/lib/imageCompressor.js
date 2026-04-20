/**
 * Compress an image file to be under a certain size (in bytes)
 * @param {File} file - The original image file
 * @param {number} maxSizeKB - The maximum size in KB
 * @returns {Promise<File|Blob>} - The compressed image
 */
export const compressImage = async (file, maxSizeKB = 100) => {
  const maxSizeBytes = maxSizeKB * 1024;
  
  if (file.size <= maxSizeBytes) {
    return file; // No compression needed
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Initial settings
        let quality = 0.8;
        let scale = 0.9;

        const attemptCompression = () => {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }

            if (blob.size <= maxSizeBytes || quality <= 0.1) {
              // Create a new File object from the blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              // Further compress: reduce quality and/or scale
              quality -= 0.1;
              if (quality < 0.3) {
                width *= scale;
                height *= scale;
              }
              attemptCompression();
            }
          }, 'image/jpeg', quality);
        };

        attemptCompression();
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
