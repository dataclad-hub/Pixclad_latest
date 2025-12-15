# app.py (final) — zip entire sorted_output and return timestamped PixClad zip
import os
import shutil
import tempfile
import zipfile
import threading
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from model_loader import get_image_tags
from auth import auth_blueprint
from gdrive import gdrive_blueprint, upload_file_to_gdrive, get_or_create_output_folder

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from flask_session import Session

# -------------------------------------------------------
# Initialize Flask App
# -------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.urandom(24)

# -------- SESSION CONFIG ----------
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_FILE_DIR"] = "flask_session"
os.makedirs("flask_session", exist_ok=True)
app.config["SESSION_PERMANENT"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_NAME"] = "session"
# -------------------------------------
# ENV-SPECIFIC COOKIE SETTINGS
# -------------------------------------
IS_RENDER = os.environ.get("RENDER") == "1"

if IS_RENDER:
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    # 🔥 IMPORTANT — backend domain for OAuth cookie
    app.config["SESSION_COOKIE_DOMAIN"] = "pixclad-backend.up.railway.app"
else:
    app.config["SESSION_COOKIE_SECURE"] = False
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_DOMAIN"] = None

Session(app)

# -------------------------------------------------------
# CORS CONFIG — FRONTEND ONLY
# -------------------------------------------------------
CORS(
    app,
    origins=[
        "https://pixclad-frontend.up.railway.app",  # Frontend (static site)
        "http://localhost:3000"                  # Local React
    ],
    supports_credentials=True
)

@app.after_request
def add_partitioned_cookie(response):
    # Read all Set-Cookie headers
    set_cookie_headers = response.headers.getlist("Set-Cookie")
    if not set_cookie_headers:
        return response

    cookie_name = app.config.get("SESSION_COOKIE_NAME", "session")
    secure_required = bool(app.config.get("SESSION_COOKIE_SECURE", False))

    new_headers = []
    for cookie in set_cookie_headers:
        first_part = cookie.split(";", 1)[0].strip()
        if first_part.startswith(f"{cookie_name}="):
            lower = cookie.lower()
            if "samesite=" not in lower:
                cookie += "; SameSite=None"
            if secure_required and "secure" not in lower:
                cookie += "; Secure"
            if "domain=" not in lower and "partitioned" not in lower:
                cookie += "; Partitioned"
        new_headers.append(cookie)

    del response.headers["Set-Cookie"]
    for c in new_headers:
        response.headers.add("Set-Cookie", c)

    return response

# -------------------------------------------------------
# Register Blueprints
# -------------------------------------------------------
app.register_blueprint(auth_blueprint, url_prefix="/auth")
app.register_blueprint(gdrive_blueprint, url_prefix="/auth/gdrive")


# -------------------------------------------------------
# Folders
# -------------------------------------------------------
UPLOAD_FOLDER = "temp_uploads"
OUTPUT_FOLDER = "sorted_output"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


# -------------------------------------------------------
# Keep Session Permanent
# -------------------------------------------------------
@app.before_request
def make_session_permanent():
    session.permanent = True
    app.permanent_session_lifetime = timedelta(days=30)


# ---- helper to cleanup files later (background thread) ----
def remove_file_later(path, delay=30):
    def _remove():
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
    t = threading.Timer(delay, _remove)
    t.daemon = True
    t.start()


# -------------------------------------------------------
# Process Upload Route (local ZIP download support)
# -------------------------------------------------------
@app.route('/process-upload', methods=['POST'])
def process_upload():
    try:
        destination = request.form.get('destination', 'local')
        uploaded_files = request.files.getlist('files')

        if not uploaded_files or not uploaded_files[0].filename:
            return jsonify({"error": "No files were selected"}), 400

        results = {}
        gdrive_service = None
        processed_local_paths = []

        if destination == 'gdrive':
            creds_data = session.get('destination_credentials', session.get('credentials'))
            if not creds_data:
                return jsonify({"error": "Google Drive not connected"}), 401

            required_keys = ["token", "token_uri", "client_id", "client_secret"]
            if not all(key in creds_data and creds_data[key] for key in required_keys):
                return jsonify({"error": "Incomplete Google Drive credentials"}), 400

            creds = Credentials(**creds_data)
            gdrive_service = build('drive', 'v3', credentials=creds)
            output_parent_id = get_or_create_output_folder(gdrive_service)

        # Process files: categorize and move
        for file in uploaded_files:
            filename = secure_filename(os.path.basename(file.filename))
            temp_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(temp_path)

            tags = get_image_tags(temp_path)
            category = tags[0] if tags and tags[0] != "Error" else "Uncategorized"
            results[filename] = tags

            if destination == 'local':
                category_folder = os.path.join(OUTPUT_FOLDER, category)
                os.makedirs(category_folder, exist_ok=True)
                dest_path = os.path.join(category_folder, filename)
                shutil.move(temp_path, dest_path)
                processed_local_paths.append(dest_path)

            elif destination == 'gdrive' and gdrive_service:
                upload_file_to_gdrive(gdrive_service, temp_path, category, output_parent_id)
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

        # If user requested local output, zip the whole OUTPUT_FOLDER and return
        if destination == 'local':
            # If you prefer only request-specific files, use processed_local_paths list.
            # The user asked for the entire sorted_output folder zip: we zip OUTPUT_FOLDER.
            # If OUTPUT_FOLDER might contain previous runs and you prefer per-request only,
            # change to zip the processed_local_paths instead.
            # Here we zip OUTPUT_FOLDER but include only files that exist currently.
            zip_timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%SZ")
            zip_name = f"PixClad_Output_{zip_timestamp}.zip"
            tmp_fd, tmp_zip_path = tempfile.mkstemp(suffix='.zip')
            os.close(tmp_fd)
            with zipfile.ZipFile(tmp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                # Walk OUTPUT_FOLDER and add files with relative path so categories are preserved
                for root, dirs, files_in_dir in os.walk(OUTPUT_FOLDER):
                    for fname in files_in_dir:
                        full_path = os.path.join(root, fname)
                        rel_path = os.path.relpath(full_path, OUTPUT_FOLDER)  # category/filename
                        zf.write(full_path, arcname=rel_path)

            # schedule cleanup
            remove_file_later(tmp_zip_path, delay=60)

            # send the zip with the timestamped filename
            try:
                return send_file(tmp_zip_path, as_attachment=True, download_name=zip_name)
            except TypeError:
                return send_file(tmp_zip_path, as_attachment=True, attachment_filename=zip_name)

        # default JSON response for gdrive
        return jsonify({"message": "Processing complete", "results": results})

    except Exception as e:
        print(f"[ERROR] process_upload failed: {e}")
        return jsonify({"error": "Failed to process upload", "details": str(e)}), 500


# -------------------------------------------------------
# Run App
# -------------------------------------------------------
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 4000))
    app.run(host="0.0.0.0", port=port, debug=False)
