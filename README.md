# ShareBite - Food Donation Platform

A comprehensive food donation platform connecting donors with NGOs, volunteers, and receivers. Built with React Native, Next.js, and AI-powered features.

## 🌟 Features

### Mobile App (React Native)
- **Multi-user system:** Donors, NGOs, Volunteers, Receivers
- **Smart donation matching** algorithm
- **Real-time delivery tracking** with live maps
- **AI chatbot assistant** for user support
- **Push notifications** for important updates
- **Offline support** with Firebase
- **Image upload** for food photos
- **Location-based** features for Pakistan

### Admin Web Panel (Next.js)
- **Dashboard** with real-time statistics
- **NGO verification** system with document review
- **Delivery tracking** with interactive maps
- **User management** and filtering
- **Responsive design** for all devices

### AI Backend
- **Chatbot** for automated support

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Android Studio (for mobile app)
- Firebase account

### Mobile App Setup

```bash
# Install dependencies
npm install

# Run on Android
npm run android

# Run on iOS (Mac only)
npm run ios
```

### Admin Panel Setup

```bash
cd admin-panel
npm install
npm run dev
```

Visit http://localhost:3000


## 📱 Mobile App Configuration

### Firebase Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication, Firestore, and Storage
3. Download `google-services.json` to `android/app/`
4. Update Firebase config in your app

## 🌐 Deployment

### Mobile App (Android APK)

```bash
# Build release APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk
```

### Admin Panel (Vercel)

```bash
cd admin-panel
vercel
```

Or deploy via Vercel dashboard.

## 🏗️ Project Structure

```
ShareBite/
├── src/                      # Mobile app source
│   ├── screens/             # All app screens
│   ├── services/            # Business logic & APIs
│   ├── navigation/          # App navigation
│   ├── components/          # Reusable components
│   └── config/              # Configuration
│
├── admin-panel/             # Admin web dashboard
│   └── src/
│       ├── app/            # Next.js pages
│       ├── components/     # React components
│       └── lib/            # Utilities
│

│
├── android/                 # Android native code
└── README.md               # This file
```

## 🛠️ Tech Stack

### Mobile App
- React Native 0.82
- TypeScript
- Firebase (Auth, Firestore, Storage)
- React Navigation
- React Native Maps

### Admin Panel
- Next.js 14
- TypeScript
- Tailwind CSS
- Firebase
- Leaflet (maps)

## 🌍 Configured for Pakistan

All location features are set for Pakistan:

**Primary Cities:**
- Islamabad (33.6844, 73.0479)
- Rawalpindi (33.5651, 73.0169)

**Also includes:**
- Lahore
- Karachi
- Peshawar

## 🔐 Security Features

- Firebase Authentication
- Auto-logout after 10 minutes
- Secure password requirements
- Firebase Security Rules
- Input validation
- Error boundaries

## 📊 User Types

1. **Donor** - Posts food donations
2. **NGO** - Claims donations (requires verification)
3. **Volunteer** - Delivers food

## 🤖 AI Features

### Smart Matching
- Finds best NGOs/receivers
- Considers distance & urgency
- Ranks by match score

### AI Chatbot
- Natural language Q&A
- Context-aware responses
- Quick suggestions

## 🎓 FYP Project

This is a complete Final Year Project demonstrating:
- ✅ Full-stack development
- ✅ AI integration
- ✅ Real-time features
- ✅ Cloud deployment
- ✅ Modern tech stack
- ✅ Production-ready code
- ✅ Security best practices
- ✅ Scalable architecture

## 🚀 Next Steps

1. ✅ Deploy admin panel to Vercel
2. ✅ Build Android APK
3. ✅ Test all features
4. ✅ Add test data
5. ✅ Launch beta testing

## 📝 License

This project is for educational purposes (FYP).

## Acknowledgments

Built with modern technologies and best practices for food donation management in Pakistan.

---

**Made with ❤️ for ShareBite FYP**
