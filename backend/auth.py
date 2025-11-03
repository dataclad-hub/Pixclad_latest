from flask import Blueprint, request, jsonify
from database import supabase # <-- Import the single supabase client

# Create a Blueprint for authentication routes
auth_blueprint = Blueprint('auth', __name__)

@auth_blueprint.route('/register', methods=['POST'])
def register_user():
    """
    Registers a new user using their email and password.
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        res = supabase.auth.sign_up({"email": email, "password": password})
        
        if res.user is None and res.session is None:
            if "User already registered" in str(res):
                 return jsonify({"error": "User with this email already exists"}), 409
            return jsonify({"error": "Registration failed", "details": str(res)}), 500

        return jsonify({
            "message": "Registration successful! Please check your email to verify your account.",
            "user_id": res.user.id,
            "email": res.user.email
        }), 201
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500


@auth_blueprint.route('/login', methods=['POST'])
def login_user():
    """
    Logs in an existing user using their email and password.
    """
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        res = supabase.auth.sign_in_with_password({"email": email, "password": password})

        return jsonify({
            "message": "Login successful!",
            "access_token": res.session.access_token,
            "user": {
                "id": res.user.id,
                "email": res.user.email
            }
        }), 200
    except Exception as e:
        return jsonify({"error": "Invalid credentials"}), 401