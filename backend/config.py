
import os
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

class Config:
    """
    Configuration class for the Flask application.
    Loads settings from environment variables.
    """
    # Supabase Configuration
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI")  # <-- Added
    FRONTEND_URL = os.environ.get("FRONTEND_URL")  # <-- Added

    # This can be any random, secret string used for signing session cookies.
    SECRET_KEY = os.environ.get("SECRET_KEY") or "you-should-really-change-this"
