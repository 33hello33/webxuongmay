import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
    throw new Error('Supabase URL is missing! Kiểm tra file .env ở thư mục gốc.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
