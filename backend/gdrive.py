import os
import io
import shutil
from flask import Blueprint, redirect, request, url_for, session, jsonify
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload
from config import Config
from model_loader import get_image_tags

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
gdrive_blueprint = Blueprint('gdrive', __name__)
SCOPES = ['https://www.googleapis.com/auth/drive']

# --- Client Config ---
client_config = {
    "web": {
        "client_id": Config.GOOGLE_CLIENT_ID,
        "project_id": "pixclad-josh",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": Config.GOOGLE_CLIENT_SECRET,
        "redirect_uris": [
            Config.GOOGLE_REDIRECT_URI,
            f"{Config.GOOGLE_REDIRECT_URI}-destination"
        ]
    }
}

# ----------------------------------------------------------
# Helper: Convert credentials to dict (FULL version)
# ----------------------------------------------------------
def credentials_to_dict(creds):
    return {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': creds.scopes
    }

# ----------------------------------------------------------
# Helper: Ensure or Create Output Folder in Drive
# ----------------------------------------------------------
def get_or_create_output_folder(service_destination):
    """Ensures 'Output' folder exists in root of destination drive."""
    output_folder_name = 'Output'
    try:
        results = service_destination.files().list(
            q=f"name='{output_folder_name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
            spaces='drive',
            fields='files(id)'
        ).execute()
        items = results.get('files', [])
        if items:
            return items[0]['id']
        folder_metadata = {'name': output_folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service_destination.files().create(body=folder_metadata, fields='id').execute()
        return folder.get('id')
    except Exception as e:
        print(f"[ERROR] Failed to get/create Output folder: {e}")
        raise

# ----------------------------------------------------------
# Helper: Upload File to Drive
# ----------------------------------------------------------
def upload_file_to_gdrive(service, file_path, folder_name, parent_id):
    """Uploads file into a folder (category) inside parent_id (Output folder)."""
    try:
        query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and '{parent_id}' in parents and trashed=false"
        results = service.files().list(q=query, fields="files(id)").execute()
        items = results.get('files', [])

        if not items:
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            folder_id = folder.get('id')
        else:
            folder_id = items[0]['id']

        file_metadata = {'name': os.path.basename(file_path), 'parents': [folder_id]}
        media = MediaFileUpload(file_path, mimetype='image/jpeg')
        service.files().create(body=file_metadata, media_body=media, fields='id').execute()

    except Exception as e:
        print(f"[ERROR] Upload failed for {file_path}: {e}")
        raise

# ----------------------------------------------------------
# Google Drive Auth Routes
# ----------------------------------------------------------
@gdrive_blueprint.route('/login')
def gdrive_login():
    """Login for source account."""
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=Config.GOOGLE_REDIRECT_URI)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',  # force consent screen again
    )
    session['state'] = state
    return redirect(authorization_url)


@gdrive_blueprint.route('/callback')
def gdrive_callback():
    """Callback for source account."""
    state = session.get('state')
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state,
        redirect_uri=Config.GOOGLE_REDIRECT_URI
    )
    flow.fetch_token(authorization_response=request.url)
    creds = flow.credentials
    session['credentials'] = credentials_to_dict(creds)
    return redirect(f"{Config.FRONTEND_URL}/dashboard")
#   changed

@gdrive_blueprint.route('/login-destination')
def gdrive_login_destination():
    """Login for destination account."""
    dest_redirect_uri = f"{Config.GOOGLE_REDIRECT_URI}-destination"
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=dest_redirect_uri)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',  # force consent again
    )
    session['state_destination'] = state
    return redirect(authorization_url)


@gdrive_blueprint.route('/callback-destination')
def gdrive_callback_destination():
    """Callback for destination account."""
    state = session.get('state_destination')
    dest_redirect_uri = f"{Config.GOOGLE_REDIRECT_URI}-destination"
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state,
        redirect_uri=dest_redirect_uri
    )
    flow.fetch_token(authorization_response=request.url)
    creds = flow.credentials
    session['destination_credentials'] = credentials_to_dict(creds)
    return redirect(f"{Config.FRONTEND_URL}/dashboard")
#  # changed

@gdrive_blueprint.route('/logout-destination')
def gdrive_logout_destination():
    """Clears destination credentials."""
    session.pop('destination_credentials', None)
    return redirect(f"{Config.FRONTEND_URL}/dashboard")


@gdrive_blueprint.route('/status')
def gdrive_status():
    """Returns connection status for both accounts."""
    return jsonify({
        'source_connected': 'credentials' in session,
        'destination_connected': 'destination_credentials' in session,
        'frontend_url': Config.FRONTEND_URL
    })

# ----------------------------------------------------------
# Google Drive Folder Processing Logic
# ----------------------------------------------------------
@gdrive_blueprint.route('/files')
def list_gdrive_files():
    if 'credentials' not in session:
        return jsonify({"error": "User not authenticated"}), 401
    creds = Credentials(**session['credentials'])
    service = build('drive', 'v3', credentials=creds)
    results = service.files().list(
        q="mimeType='application/vnd.google-apps.folder' and 'root' in parents",
        pageSize=20,
        fields="files(id, name)"
    ).execute()
    return jsonify(results.get('files', []))


@gdrive_blueprint.route('/process-folder/<folder_id>', methods=['POST'])
def process_gdrive_folder(folder_id):
    if 'credentials' not in session:
        return jsonify({"error": "User not authenticated"}), 401

    destination = request.json.get('destination', 'local')
    if destination == 'gdrive-destination' and 'destination_credentials' not in session:
        return jsonify({"error": "Destination Google Drive not connected"}), 401

    try:
        creds_source = Credentials(**session['credentials'])
        service_source = build('drive', 'v3', credentials=creds_source)

        service_destination, output_parent_id = None, None
        if destination == 'gdrive-source':
            service_destination = service_source
            output_parent_id = get_or_create_output_folder(service_destination)
        elif destination == 'gdrive-destination':
            creds_dest = Credentials(**session['destination_credentials'])
            service_destination = build('drive', 'v3', credentials=creds_dest)
            output_parent_id = get_or_create_output_folder(service_destination)

        query = f"'{folder_id}' in parents and (mimeType='image/jpeg' or mimeType='image/png')"
        images = service_source.files().list(q=query, fields="files(id, name)").execute().get('files', [])
        if not images:
            return jsonify({"message": "No images found.", "results": {}})

        UPLOAD_FOLDER, OUTPUT_FOLDER = 'temp_uploads', 'sorted_output'
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        results = {}

        for image in images:
            image_name, image_id = image['name'], image['id']
            temp_path = os.path.join(UPLOAD_FOLDER, image_name)

            request_file = service_source.files().get_media(fileId=image_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request_file)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            with open(temp_path, 'wb') as f:
                f.write(fh.getvalue())

            tags = get_image_tags(temp_path)
            category = tags[0] if tags and tags[0] != "Error" else "Uncategorized"

            if destination == 'local':
                os.makedirs(os.path.join(OUTPUT_FOLDER, category), exist_ok=True)
                shutil.move(temp_path, os.path.join(OUTPUT_FOLDER, category, image_name))
            else:
                upload_file_to_gdrive(service_destination, temp_path, category, output_parent_id)
                os.remove(temp_path)

            results[image_name] = tags

        return jsonify({"message": "Processing complete!", "results": results})

    except Exception as e:
        print(f"[ERROR] Failed to process folder: {e}")
        return jsonify({"error": "Failed to process folder", "details": str(e)}), 500
