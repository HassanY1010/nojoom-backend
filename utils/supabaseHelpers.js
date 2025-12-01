import { supabase } from '../config/supabase.js';

export const getSignedVideoUrl = async (fileName) => {
  if (!fileName) return null;

  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10); // 10 سنوات

  if (error) {
    console.error('❌ Signed URL error:', error);
    return null;
  }

  return data.signedUrl;
};