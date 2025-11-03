from supabase import create_client, Client
from config import Config

# Initialize the Supabase client using settings from our config file
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)