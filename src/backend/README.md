# ShareBite Backend API

Express.js backend with Firebase Authentication and Firestore database.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Firebase Admin Setup

#### Option A: Using Service Account Key (Recommended for Development)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the file as `serviceAccountKey.json` in the `backend/` folder

#### Option B: Using Environment Variables (Recommended for Production)

1. Get your service account key (same as above)
2. Copy `.env.example` to `.env`
3. Fill in the values from your service account key:

```env
PORT=3000
NODE_ENV=development

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

### 3. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will run on: `http://localhost:3000`

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "userType": "donor",
  "phone": "+1234567890",
  "address": "123 Main St"
}
```

#### Login (Validate User)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <firebase-id-token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <firebase-id-token>
```

### Donations

#### Create Donation
```http
POST /api/donations
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "foodType": "Fresh Vegetables",
  "quantity": 10,
  "expiryDate": "2024-12-31",
  "pickupAddress": "123 Main St",
  "description": "Fresh organic vegetables"
}
```

#### Get All Donations
```http
GET /api/donations?status=available&limit=50
Authorization: Bearer <firebase-id-token>
```

#### Get Donation by ID
```http
GET /api/donations/:id
Authorization: Bearer <firebase-id-token>
```

#### Update Donation
```http
PUT /api/donations/:id
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "status": "claimed",
  "quantity": 5
}
```

#### Delete Donation
```http
DELETE /api/donations/:id
Authorization: Bearer <firebase-id-token>
```

## Validation Rules

### Registration
- **email**: Valid email format
- **password**: Min 6 characters, must contain at least one number
- **name**: 2-50 characters
- **userType**: Must be one of: `donor`, `ngo`, `volunteer`, `receiver`

### Donation
- **foodType**: Required, non-empty string
- **quantity**: Positive integer
- **expiryDate**: Valid ISO 8601 date
- **pickupAddress**: Required, non-empty string
- **description**: Optional, max 500 characters

## Authentication Flow

1. **Client Side** (React Native):
   - User signs up/logs in using Firebase Auth
   - Get ID token: `await user.getIdToken()`

2. **API Requests**:
   - Include token in Authorization header: `Bearer <token>`
   - Backend verifies token with Firebase Admin SDK

3. **Protected Routes**:
   - All routes except `/api/auth/register` and `/api/auth/login` require authentication

## Error Responses

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Project Structure

```
backend/
├── config/
│   └── firebase.js          # Firebase Admin initialization
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── validation.js        # Validation rules
├── routes/
│   ├── auth.js              # Authentication routes
│   └── donations.js         # Donation routes
├── .env.example             # Environment variables template
├── .gitignore              # Git ignore file
├── package.json            # Dependencies
├── README.md               # This file
└── server.js               # Main server file
```

## Testing with Postman/Thunder Client

1. Register a user
2. Login with Firebase (client-side) to get ID token
3. Use the token in Authorization header for protected routes

## Security Features

- ✅ Helmet.js for security headers
- ✅ CORS enabled
- ✅ Firebase token verification
- ✅ Input validation with express-validator
- ✅ User authorization checks
- ✅ Environment variables for sensitive data

## Next Steps

1. Add more routes (users, requests, deliveries)
2. Implement real-time notifications
3. Add file upload for images
4. Implement rate limiting
5. Add API documentation (Swagger)
