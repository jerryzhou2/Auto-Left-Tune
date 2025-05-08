import json
from app.config.config import Config
import os
class SessionManager:
    _instance = None
    _session_data = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SessionManager, cls).__new__(cls)
            cls._instance._load_session_data()
        return cls._instance
    
    def _load_session_data(self):
        try:
            if os.path.exists(Config.SESSION_FILE):
                with open(Config.SESSION_FILE, 'r') as f:
                    self._session_data = json.load(f)
        except Exception as e:
            print(f"Error loading session data: {e}")
            self._session_data = {}
    
    def save_session_data(self):
        try:
            with open(Config.SESSION_FILE, 'w') as f:
                json.dump(self._session_data, f)
        except Exception as e:
            print(f"Error saving session data: {e}")
    
    def get_session(self, session_id):
        return self._session_data.get(session_id)
    
    def create_session(self, session_id, data):
        self._session_data[session_id] = data
        self.save_session_data()
    
    def session_exists(self, session_id):
        return session_id in self._session_data 