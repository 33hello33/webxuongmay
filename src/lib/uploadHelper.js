import { supabase } from '../supabase';
import { compressImage } from './imageCompressor';

/**
 * Unified Upload Helper
 * Always uses Supabase Storage for reliability and simplicity
 */
export const uploadImage = async (file, bucket = 'assets') => {
  try {
    // 0. Compress image if needed (target 100KB)
    let fileToUpload = file;
    if (file.size > 100 * 1024) {
      console.log(`Original size: ${(file.size / 1024).toFixed(2)}KB. Compressing...`);
      fileToUpload = await compressImage(file, 100);
      console.log(`Compressed size: ${(fileToUpload.size / 1024).toFixed(2)}KB`);
    }

    // 1. Upload to Supabase Storage
    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    alert('Lỗi tải ảnh: ' + error.message);
    return null;
  }
};

