#!/bin/bash

echo "🚀 Installing Google Sign-In for ShareBite..."
echo ""

# Install the package
echo "📦 Installing @react-native-google-signin/google-signin..."
npm install @react-native-google-signin/google-signin

# Install pods for iOS
echo ""
echo "🍎 Installing iOS dependencies..."
cd ios
pod install
cd ..

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Get your Web Client ID from Firebase Console"
echo "2. Update src/services/auth.ts with your Web Client ID"
echo "3. Follow GOOGLE_SIGNIN_SETUP.md for Android/iOS configuration"
echo ""
echo "🎉 You're ready to use Google Sign-In!"
