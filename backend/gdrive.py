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
client_config = {
    "web": {
        "client_id": Config.GOOGLE_CLIENT_ID, "project_id": "pixclad-uploader",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": Config.GOOGLE_CLIENT_SECRET,
        "redirect_uris": [Config.GOOGLE_REDIRECT_URI]
    }
}

def upload_file_to_gdrive(service, file_path, folder_name):
    query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and 'root' in parents"
    results = service.files().list(q=query, fields="files(id)").execute()
    items = results.get('files', [])
    if not items:
        folder_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        folder_id = folder.get('id')
    else:
        folder_id = items[0].get('id')
    file_metadata = {'name': os.path.basename(file_path), 'parents': [folder_id]}
    media = MediaFileUpload(file_path, mimetype='image/jpeg')
    service.files().create(body=file_metadata, media_body=media, fields='id').execute()

@gdrive_blueprint.route('/login')
def gdrive_login():
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=Config.GOOGLE_REDIRECT_URI)
    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    session['state'] = state
    return redirect(authorization_url)

@gdrive_blueprint.route('/callback')
def gdrive_callback():
    state = session['state']
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state,
        redirect_uri=Config.GOOGLE_REDIRECT_URI
    )
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    session['credentials'] = {'token': credentials.token, 'refresh_token': credentials.refresh_token, 'token_uri': credentials.token_uri, 'client_id': credentials.client_id, 'client_secret': credentials.client_secret, 'scopes': credentials.scopes}
    return redirect(f"{Config.FRONTEND_URL}/dashboard")

@gdrive_blueprint.route('/files')
def list_gdrive_files():
    if 'credentials' not in session: return jsonify({"error": "User not authenticated"}), 401
    creds = Credentials(**session['credentials'])
    service = build('drive', 'v3', credentials=creds)
    results = service.files().list(q="mimeType='application/vnd.google-apps.folder' and 'root' in parents", pageSize=20, fields="files(id, name)").execute()
    return jsonify(results.get('files', []))

@gdrive_blueprint.route('/process-folder/<folder_id>', methods=['POST'])
def process_gdrive_folder(folder_id):
    if 'credentials' not in session: return jsonify({"error": "User not authenticated"}), 401
    destination = request.json.get('destination', 'local')
    try:
        creds = Credentials(**session['credentials'])
        service = build('drive', 'v3', credentials=creds)
        query = f"'{folder_id}' in parents and (mimeType='image/jpeg' or mimeType='image/png')"
        images = service.files().list(q=query, fields="files(id, name)").execute().get('files', [])
        if not images: return jsonify({"message": "No images found.", "results": {}})
        UPLOAD_FOLDER, OUTPUT_FOLDER = 'temp_uploads', 'sorted_output'
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        processing_results = {}
        for image in images:
            image_name, image_id = image.get('name'), image.get('id')
            temp_path = os.path.join(UPLOAD_FOLDER, image_name)
            request_file = service.files().get_media(fileId=image_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request_file)
            done = False
            while not done: status, done = downloader.next_chunk()
            with open(temp_path, 'wb') as f: f.write(fh.getvalue())
            tags = get_image_tags(temp_path)
            target_category = tags[0] if tags and tags[0] != "Error" else "Uncategorized"
            if destination == 'local':
                dest_folder = os.path.join(OUTPUT_FOLDER, target_category)
                os.makedirs(dest_folder, exist_ok=True)
                shutil.move(temp_path, os.path.join(dest_folder, image_name))
            elif destination == 'gdrive':
                upload_file_to_gdrive(service, temp_path, target_category)
                os.remove(temp_path)
            processing_results[image_name] = tags
        return jsonify({"message": "Processing complete!", "results": processing_results})
    except Exception as e:
        return jsonify({"error": "Failed to process folder", "details": str(e)}), 500
