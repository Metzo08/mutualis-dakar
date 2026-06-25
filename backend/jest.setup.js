// Variables d'environnement de test (JWT_SECRET requis par server.js)
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_at_least_32_chars_long_for_testing_only_0987654321';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// Désactive la clé Gemini pour utiliser le fallback local du chatbot
process.env.GEMINI_API_KEY = '';
