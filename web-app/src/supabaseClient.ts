import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qvzotkqkezxtguphlkaw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2em90a3FrZXp4dGd1cGhsa2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjEyNTUsImV4cCI6MjEwMzk5NzI1NX0.Yz6c45YC7rduC6rZar4MKdskFUp6B1P9qKo_h5kkOzI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
