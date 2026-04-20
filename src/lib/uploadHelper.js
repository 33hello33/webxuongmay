import { supabase } from '../supabase';
import { uploadToGDrive } from './gdrive';
import { compressImage } from './imageCompressor';

/**
 * Unified Upload Helper
 * Prioritizes Google Drive if configured, otherwise uses Supabase Storage
 */
export const uploadImage = async (file, bucket = 'products') => {
  try {
    // 0. Compress image if needed (target 100KB)
    let fileToUpload = file;
    if (file.size > 100 * 1024) {
      console.log(`Original size: ${(file.size / 1024).toFixed(2)}KB. Compressing...`);
      fileToUpload = await compressImage(file, 100);
      console.log(`Compressed size: ${(fileToUpload.size / 1024).toFixed(2)}KB`);
    }

    // 1. Fetch GDrive config from Supabase
    const { data: configData } = await supabase
      .from('tbl_config')
      .select('value')
      .eq('key', 'gdrive_config')
      .single();

    const gdrive = configData?.value;

    // 2. If GDrive is configured and has a folder_id, try uploading there
    if (gdrive && gdrive.folder_id && gdrive.client_id) {
      try {
        const result = await uploadToGDrive(
          fileToUpload, 
          gdrive.folder_id, 
          gdrive.client_id, 
          null, // api_key if needed
          'oauth'
        );
        // Use the thumbnail endpoint which is more optimized for web views and less likely to hit 429
        if (result.id) {
          return `https://drive.google.com/thumbnail?id=${result.id}&sz=w600`;
        }
        
        return result.thumbnailLink ? result.thumbnailLink.replace(/=s\d+$/, '=s600') : result.webViewLink;

      } catch (err) {
        console.error('Google Drive upload failed, falling back to Supabase:', err);
        // Fallback to Supabase if GDrive fails
      }
    }

    // 3. Fallback: Supabase Storage
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
    console.error('All upload methods failed:', error);
    alert('Lỗi tải ảnh: ' + error.message);
    return null;
  }
};
