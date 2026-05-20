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

        // Cap initial dimensions to a reasonable max size (e.g., 1280px)
        const MAX_DIMENSION = 1280;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        // Initial settings
        let quality = 0.8;
        let scale = 0.85;

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

            // Stop if under limit or dimensions are ridiculously small
            if (blob.size <= maxSizeBytes || (width < 200 && height < 200)) {
              let newFileName = file.name;
              const dotIndex = newFileName.lastIndexOf('.');
              if (dotIndex !== -1) {
                newFileName = newFileName.substring(0, dotIndex) + '.jpg';
              } else {
                newFileName += '.jpg';
              }
              
              // Create a new File object from the blob
              const compressedFile = new File([blob], newFileName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              // Further compress: reduce quality or scale
              if (quality > 0.5) {
                quality -= 0.1;
              } else {
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
                if (quality > 0.3) {
                  quality -= 0.05;
                }
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
