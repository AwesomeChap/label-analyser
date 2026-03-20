import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'label-images';

if (!url || !key) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; DB and storage will fail.');
}

export const supabase = url && key ? createClient(url, key) : null;
export { bucketName };
