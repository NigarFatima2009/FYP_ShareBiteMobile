# ShareBite Admin Panel

Web-based admin dashboard for managing NGO verifications, tracking deliveries, and overseeing the ShareBite platform.

## Features

- **Dashboard Overview** - Real-time statistics and quick actions
- **NGO Verification** - Review and approve/reject NGO applications with document verification
- **Delivery Tracking** - Live map view of active deliveries with real-time updates
- **User Management** - View and filter all platform users

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Firebase (Auth, Firestore)
- Leaflet (Map visualization)

## Setup

1. **Install dependencies:**
   ```bash
   cd admin-panel
   npm install
   ```

2. **Configure Firebase:**
   - Copy `.env.example` to `.env.local`
   - Add your Firebase configuration from the main app
   ```bash
   cp .env.example .env.local
   ```

3. **Create admin user in Firebase:**
   - Go to Firebase Console > Authentication
   - Add a new user with email/password
   - This will be your admin login

4. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Add admin panel"
   git push
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository
   - Set root directory to `admin-panel`
   - Add environment variables from `.env.local`
   - Click "Deploy"

3. **Environment Variables on Vercel:**
   Add these in Project Settings > Environment Variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

## Usage

1. Login with your admin credentials
2. Navigate through the sidebar to access different sections
3. Approve/reject NGO applications in the verification section
4. Monitor active deliveries on the map in real-time
5. View all users and their details

## Security Notes

- Only authenticated users can access the dashboard
- Make sure to use strong passwords for admin accounts
- Consider adding role-based access control in Firebase
- Keep your environment variables secure

## Future Enhancements

- Email notifications for NGO verification decisions
- Export data to CSV/Excel
- Advanced analytics and reporting
- Push notifications for critical events
- Multi-admin support with different permission levels
