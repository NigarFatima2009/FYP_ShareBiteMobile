import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { colors, typography, spacing, borderRadius } from '../theme';
import logger from '../utils/logger';
import { runShareBiteAgent, ngosAgentPersona, donorAgentPersona, allergenAgentPersona } from '../utils/AgentHelper';
import { geocodeAddress } from '../services/locationService';
import { AllergyChart, ALLERGENS } from '../components/AllergyChart';
import { AddressAutocomplete } from '../components/common/AddressAutocomplete';

// Simple date formatter
const formatDate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const formatTime = (date: Date) => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const formatDateTime = (date: Date) => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

interface PostFoodDonationProps {
  navigation: any;
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
  addNotification: (notification: any) => void;
}

export const PostFoodDonation: React.FC<PostFoodDonationProps> = ({
  navigation,
  user,
  appState,
  updateAppState,
  addNotification,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    foodType: '',
    servings: '',
    bestBefore: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    location: '',
    specialInstructions: '',
    images: [] as string[],
    // Dietary preferences
    dietaryType: '' as '' | 'vegetarian' | 'non-vegetarian' | 'sweets-bakery',
    isHomemade: true,
    spiceLevel: 'medium' as 'mild' | 'medium' | 'spicy',
    allergens: [] as string[],
    ingredients: '',
    isSafetyConfirmed: false,
    ignoreSafetyRisk: false,
    coordinates: null as { latitude: number, longitude: number } | null,
  });
  const [analyzingAllergens, setAnalyzingAllergens] = useState(false);
  const [safetyRisk, setSafetyRisk] = useState<{ level: string; reason: string; advice?: string; risks?: string[] } | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [showBestBeforePicker, setShowBestBeforePicker] = useState(false);
  const [showPickupTimePicker, setShowPickupTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingDonationData, setPendingDonationData] = useState<any>(null);
  const [ocrValidating, setOcrValidating] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const foodTypes = ['Main Course', 'Side Dish', 'Dessert', 'Sweets/Bakery', 'Snacks', 'Beverages', 'Groceries', 'Baked Goods'];
  const dietaryTypes = [
    { value: 'vegetarian', label: 'Vegetarian/Vegan', icon: 'leaf-outline', desc: 'No meat, fish, or animal products' },
    { value: 'non-vegetarian', label: 'Non-Vegetarian', icon: 'nutrition-outline', desc: 'Contains meat or fish' },
    { value: 'sweets-bakery', label: 'Sweets/Bakery', icon: 'ice-cream-outline', desc: 'Cakes, pastries, mithai, desserts' },
  ];

  // AI-based allergen detection - returns only relevant allergens for the food
  const spiceLevels = [
    { value: 'mild', label: 'Mild', icon: 'happy-outline', color: colors.primary },
    { value: 'medium', label: 'Medium', icon: 'flame-outline', color: '#F59E0B' },
    { value: 'spicy', label: 'Spicy', icon: 'flame', color: '#EF4444' },
  ];

  const handleImagePick = async () => {
    try {
      const { launchImageLibrary } = require('react-native-image-picker');

      const options = {
        mediaType: 'photo' as const,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
      };

      launchImageLibrary(options, async (response: any) => {
        if (response.didCancel) {
          logger.info('User cancelled image picker');
        } else if (response.errorCode) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: response.errorMessage || 'Failed to pick image',
          });
        } else if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, uri],
          }));

        }
      });
    } catch (error: any) {
      logger.error('Image picker error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
      });
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { launchCamera } = require('react-native-image-picker');

      const options = {
        mediaType: 'photo' as const,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
        saveToPhotos: true,
      };

      launchCamera(options, async (response: any) => {
        if (response.didCancel) {
          logger.info('User cancelled camera');
        } else if (response.errorCode) {
          if (response.errorCode === 'camera_unavailable') {
            Toast.show({
              type: 'error',
              text1: 'Camera Unavailable',
              text2: 'Camera is not available on this device',
            });
          } else if (response.errorCode === 'permission') {
            Toast.show({
              type: 'error',
              text1: 'Permission Denied',
              text2: 'Camera permission is required',
            });
          } else {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: response.errorMessage || 'Failed to capture image',
            });
          }
        } else if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, uri],
          }));

        }
      });
    } catch (error: any) {
      logger.error('Camera error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to capture image',
      });
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validateStep1 = () => {
    const newErrors: any = {};
    if (!formData.title.trim()) newErrors.title = 'Food title is required';
    if (!formData.foodType) newErrors.foodType = 'Please select a food type';
    if (!formData.servings || parseInt(formData.servings) < 1) newErrors.servings = 'Please specify servings';

    // Expiry Check
    if (formData.bestBefore < new Date()) {
      newErrors.bestBefore = 'Best before date cannot be in the past';
      Toast.show({
        type: 'error',
        text1: 'Food Expired!',
        text2: 'You cannot donate food that is already past its best before date.',
      });
    }

    if (!formData.dietaryType) {
      newErrors.dietaryType = 'Please select a dietary type';
    }

    if (!formData.isSafetyConfirmed) {
      newErrors.isSafetyConfirmed = 'You must confirm food safety';
      Toast.show({
        type: 'error',
        text1: 'Safety Confirmation',
        text2: 'Please confirm that the food is fresh and safe to donate.',
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: any = {};
    if (!formData.location.trim()) newErrors.location = 'Pickup location is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const openBestBeforePicker = () => {
    setTempDate(formData.bestBefore);
    setShowBestBeforePicker(true);
  };

  const openPickupTimePicker = () => {
    setTempDate(formData.pickupTime);
    setShowPickupTimePicker(true);
  };

  const confirmBestBefore = () => {
    setFormData(prev => ({ ...prev, bestBefore: tempDate }));
    setShowBestBeforePicker(false);
  };

  const confirmPickupTime = () => {
    setFormData(prev => ({ ...prev, pickupTime: tempDate }));
    setShowPickupTimePicker(false);
  };

  const adjustDate = (days: number) => {
    const newDate = new Date(tempDate);
    newDate.setDate(newDate.getDate() + days);
    setTempDate(newDate);
  };

  const adjustTime = (hours: number) => {
    const newDate = new Date(tempDate);
    newDate.setHours(newDate.getHours() + hours);
    setTempDate(newDate);
  };

  const adjustMinutes = (minutes: number) => {
    const newDate = new Date(tempDate);
    newDate.setMinutes(newDate.getMinutes() + minutes);
    setTempDate(newDate);
  };


  const [isInspecting, setIsInspecting] = useState(false);

  // Local safety keywords for fallback when AI is offline
  const runLocalSafetyCheck = (text: string) => {
    const suspiciousWords = [
      'mold', 'smell', 'scent', 'sour', 'old', 'expired', 'stink', 'bad',
      'fungus', 'rotten', 'spoiled', 'slimy', 'discolored', 'fuzzy', 'leak'
    ];
    const textLower = text.toLowerCase();
    const found = suspiciousWords.find(word => textLower.includes(word));

    if (found) {
      return { isSafe: false, reason: `Local Scan: Potential safety issue detected.`, advice: `Found suspicious word "${found}". Please ensure food is fresh and not spoiled.` };
    }
    return { isSafe: true };
  };

  const handleNext = async () => {
    // 1. Initial Validation
    if (!validateStep1()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill in all required fields correctly.',
      });
      return;
    }

    // 2. HARD-BLOCK EXPIRED FOOD (Don't even call AI)
    // Extra safety: ensure bestBefore is a valid date
    const expiryDate = formData.bestBefore instanceof Date ? formData.bestBefore : new Date(formData.bestBefore);
    // Allow a 5 minute buffer for system clock drift
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (!expiryDate || isNaN(expiryDate.getTime()) || expiryDate < fiveMinutesAgo) {
      Toast.show({
        type: 'error',
        text1: 'Food Expired!',
        text2: 'Safety Rule: You cannot donate food that is already past its best before date.',
        visibilityTime: 6000,
      });
      setSafetyRisk({ level: 'high', reason: 'BEST BEFORE DATE EXPIRED' });
      return;
    }

    if (safetyRisk && formData.ignoreSafetyRisk) {
      // User explicitly opted to bypass the safety warning
      setCurrentStep(2);
      return;
    }

    setIsInspecting(true);
    setSafetyRisk(null);

    try {
      logger.info('Running Paranoid Safety Inspector...');
      const inspectionDecision = await runShareBiteAgent(donorAgentPersona, {
        donorInput: formData.description || formData.title,
        foodTitle: formData.title,
        ingredients: formData.ingredients,
        isHomemade: formData.isHomemade,
        bestBefore: formData.bestBefore.toISOString(),
        currentDate: new Date().toISOString(),
      });

      if (inspectionDecision) {
        if (!inspectionDecision.isSafeToDonate) {
          setSafetyRisk({
            level: inspectionDecision.riskLevel || 'high',
            reason: inspectionDecision.safetyRejectionReason || 'Safety risk detected',
            advice: inspectionDecision.safetyAdvice,
            risks: inspectionDecision.identifiedRisks,
          });
          Toast.show({
            type: 'error',
            text1: 'Safety Warning!',
            text2: inspectionDecision.safetyRejectionReason || 'This item cannot be donated for safety reasons.',
            visibilityTime: 6000,
          });
          setIsInspecting(false);
          return; // STRICT BLOCK
        }

        if (inspectionDecision.requiresImmediateRefrigeration) {
          Toast.show({
            type: 'info',
            text1: 'Handling Instruction',
            text2: 'AI detects this needs immediate refrigeration until pickup.',
            visibilityTime: 5000,
          });
        }

        // Auto-fill and success
        if (!formData.servings && inspectionDecision.estimatedServings) {
          setFormData(prev => ({ ...prev, servings: inspectionDecision.estimatedServings.toString() }));
        }

        Toast.show({
          type: 'info',
          text1: 'Safety Cleared',
          text2: `AI confirms safe level (${inspectionDecision.riskLevel}). ~${inspectionDecision.estimatedServings || formData.servings} servings.`,
          visibilityTime: 3000,
        });

        // SUCCESS: Move to next step
        setCurrentStep(2);
      } else {
        throw new Error("AI Safety Check could not be completed.");
      }
    } catch (e: any) {
      logger.error("AI Inspector failed to run", e);

      // FALLBACK: Use Local Scanner if AI fails
      const localCheck = runLocalSafetyCheck(`${formData.title} ${formData.description}`);

      if (localCheck.isSafe) {
        // AI was busy, but we verified locally. Silent success to keep UI clean.
        setCurrentStep(2);
      } else {
        setSafetyRisk({
          level: 'high',
          reason: localCheck.reason || 'Local scan detected safety risk.',
          advice: localCheck.advice
        });
        Toast.show({
          type: 'error',
          text1: 'Safety Warning',
          text2: localCheck.reason || 'Potential safety risk detected in your description.',
          visibilityTime: 6000,
        });
      }
    } finally {
      setIsInspecting(false);
    }
  };

  const handleAllergenScan = async () => {
    if (!formData.title?.trim() && !formData.description?.trim()) {
      setFormData(prev => ({ ...prev, allergens: [] })); // Clear if text removed
      Toast.show({
        type: 'error',
        text1: 'Missing Info',
        text2: 'Please add a title or description first so AI can analyze it.',
      });
      return;
    }

    setAnalyzingAllergens(true);

    // Safety Net: Local Keyword Scanning for typos
    const localAllergens: string[] = [];
    const textToScan = `${formData.title} ${formData.description} ${formData.ingredients}`.toLowerCase();

    const LOCAL_ALLERGEN_MAP = [
      { id: 'Peanuts', keywords: ['peanut', 'peanit', 'penaut', 'moongphali'] },
      { id: 'Tree Nuts', keywords: ['nut', 'almond', 'walnut', 'cashew', 'kaju', ' अखरोट', 'बादाम'] },
      { id: 'Milk', keywords: ['milk', 'dairy', 'malk', 'dary', 'butter', 'cheese', 'cheeze', 'yogurt', 'doodh', 'makhan'] },
      { id: 'Eggs', keywords: ['egg', 'eg', 'anda', 'egs'] },
      { id: 'Gluten', keywords: ['flour', 'wheat', 'bread', 'roti', 'atta', 'maida', 'gluten', 'pizza', 'piza'] },
      { id: 'Fish', keywords: ['fish', 'machli'] },
      { id: 'Shellfish', keywords: ['shrimp', 'prawn', 'crab', 'prawns'] },
      { id: 'Soya', keywords: ['soy', 'soya'] },
      { id: 'Sesame', keywords: ['sesame', 'til'] },
      { id: 'Mustard', keywords: ['mustard', 'sarson'] },
    ];

    LOCAL_ALLERGEN_MAP.forEach(a => {
      if (a.keywords.some(k => textToScan.includes(k))) {
        localAllergens.push(a.id);
      }
    });

    if (localAllergens && localAllergens.length > 0) {
      setFormData(prev => ({
        ...prev,
        allergens: [...(localAllergens || [])] // REPLACE, don't append, to ensure sync with current text
      }));
    } else {
      // Clear allergens if nothing found locally
      setFormData(prev => ({
        ...prev,
        allergens: []
      }));
    }

    try {
      const result = await runShareBiteAgent(allergenAgentPersona, {
        title: formData.title,
        description: formData.description,
        ingredients: formData.ingredients,
      });

      if (result && (result.detectedAllergens || localAllergens.length > 0)) {
        const aiAllergens = Array.isArray(result.detectedAllergens) ? result.detectedAllergens : [];
        const combined = [...new Set([...localAllergens, ...aiAllergens])];
        setFormData(prev => ({
          ...prev,
          allergens: [...combined] // REPLACE to keep in sync with current text
        }));

        if (combined.length > 0) {
          Toast.show({
            type: 'info',
            text1: 'Allergen(s) Detected',
            text2: `Found: ${combined.join(', ')}`,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'No Allergens Found',
            text2: 'AI scan complete. No common allergens detected.',
          });
        }
      }
    } catch (e) {
      if (localAllergens.length > 0) {
        Toast.show({ type: 'info', text1: 'Local Scan Complete', text2: 'AI was busy, but local scan found allergens.' });
      } else {
        Toast.show({ type: 'error', text1: 'Scan Failed', text2: 'Could not analyze allergens.' });
      }
    } finally {
      setAnalyzingAllergens(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      foodType: '',
      servings: '',
      bestBefore: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      location: '',
      specialInstructions: '',
      images: [],
      dietaryType: '',
      isHomemade: true,
      spiceLevel: 'medium',
      allergens: [],
      ingredients: '',
      isSafetyConfirmed: false,
      ignoreSafetyRisk: false,
      coordinates: null as { latitude: number; longitude: number } | null,
    });
    setErrors({});
  };

  /**
   * THE SAFETY GATE: 
   * This is the ONLY function allowed to save a donation to Firestore.
   * It re-verifies safety and expiry right before the commit.
   */
  const performFinalSubmission = async (effectiveUserId: string, effectiveUser: any) => {
    // 1. FINAL EXPIRY CHECK (Normalized to the millisecond)
    const now = new Date();
    const expiryDate = formData.bestBefore instanceof Date ? formData.bestBefore : new Date(formData.bestBefore);

    if (!expiryDate || isNaN(expiryDate.getTime()) || expiryDate.getTime() < now.getTime()) {
      setIsSubmitting(false);
      Toast.show({
        type: 'error',
        text1: 'Safety Blocked',
        text2: 'This food has expired and cannot be posted.',
      });
      return;
    }

    // 2. FINAL AI SAFETY CHECK
    if (safetyRisk && safetyRisk.level === 'high' && !formData.ignoreSafetyRisk) {
      setIsSubmitting(false);
      Toast.show({
        type: 'error',
        text1: 'Safety Blocked',
        text2: `AI Warning: ${safetyRisk.reason}`,
      });
      return;
    }

    try {
      const firestore = require('@react-native-firebase/firestore').default;

      // FETCH DONOR PROFILE (Gatekeeper also verifies role)
      let donorName = '';
      let donorPhone = '';

      const userDoc = await firestore().collection('users').doc(effectiveUserId).get();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData?.userType !== 'donor') {
          throw new Error(`Account type mismatch. Role is "${userData?.userType}". Only Donors can post.`);
        }
        donorName = userData?.name || userData?.displayName || effectiveUser.email?.split('@')[0] || '';
        donorPhone = userData?.phone || userData?.phoneNumber || '';
      } else {
        throw new Error('User profile not found. Please complete registration.');
      }

      const locationCoords = formData.coordinates || geocodeAddress(formData.location) || { latitude: 33.5651, longitude: 73.0169 };

      const donationData: any = {
        title: formData.title,
        description: formData.description,
        foodType: formData.foodType,
        quantity: formData.servings,
        servings: parseInt(formData.servings),
        bestBefore: formData.bestBefore.toISOString(),
        pickupTime: formData.pickupTime.toISOString(),
        pickupAddress: formData.location,
        coordinates: locationCoords,
        specialInstructions: formData.specialInstructions,
        allergens: formData.allergens || [],
        ingredients: formData.ingredients || '',
        images: formData.images,
        dietaryType: formData.dietaryType,
        isHomemade: formData.isHomemade,
        spiceLevel: formData.spiceLevel,
        donorId: effectiveUserId,
        donorEmail: effectiveUser.email || '',
        donorName: donorName,
        donorPhone: donorPhone,
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // WRITE TO FIRESTORE
      const docRef = await firestore().collection('donations').add(donationData);

      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Your donation has been posted successfully',
      });

      addNotification({
        id: Date.now(),
        type: 'donation',
        title: 'Donation Posted',
        message: `Your ${formData.title} is now available for pickup`,
        timestamp: new Date().toISOString(),
        read: false,
        urgent: false,
      });

      // Run Recommendation Engine
      try {
        const { generateRecommendationsForDonation } = require('../services/recommendationEngine');
        // Check urgency based on expiry time (within 3 hours)
        const expiryTime = new Date(formData.bestBefore).getTime();
        const nowTime = new Date().getTime();
        const isUrgentDonation = (expiryTime - nowTime) < (3 * 60 * 60 * 1000);

        const recs = await generateRecommendationsForDonation(
          formData.foodType,
          parseInt(formData.servings) || 1,
          locationCoords,
          isUrgentDonation,
          formData.allergens
        );

        if (recs && recs.length > 0) {
          setRecommendations(recs);
          setShowRecommendationsModal(true);
        } else {
          resetForm();
          setTimeout(() => navigation.navigate('MyDonations'), 1000);
        }
      } catch (e) {
        logger.error('Recommendation Engine Error', e);
        resetForm();
        setTimeout(() => navigation.navigate('MyDonations'), 1000);
      }

    } catch (error: any) {
      logger.error('Final Submission Error', error);
      Toast.show({ type: 'error', text1: 'Submission Error', text2: error.message });
      setIsSubmitting(false);
    }
  };


  const handleSubmit = async () => {
    if (!validateStep2()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fill in all required fields',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const auth = require('@react-native-firebase/auth').default;
      const firestore = require('@react-native-firebase/firestore').default;

      // Check if user is logged in (Firebase or demo account)
      const currentUser = auth().currentUser;
      const effectiveUser = currentUser || user;

      if (!effectiveUser) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to post a donation',
        });
        setIsSubmitting(false);
        return;
      }

      const effectiveUserId = effectiveUser.uid || effectiveUser.id;

      // Check for expiry - best before must be in the future
      const now = new Date();
      if (formData.bestBefore < now) {
        Toast.show({
          type: 'error',
          text1: 'Expired Food',
          text2: 'Cannot post food that has already expired. Please check the best-before date.',
          visibilityTime: 5000,
        });
        setIsSubmitting(false);
        return;
      }



      // ============================================
      // ADVANCED ML DUPLICATE DETECTION
      // Uses: TF-IDF, Jaccard, Levenshtein, N-gram
      // ============================================

      let existingDonationsData: any[] = [];
      try {
        const allDonations = await firestore()
          .collection('donations')
          .get();

        existingDonationsData = allDonations.docs
          .map((doc: any) => ({ id: doc.id, ...doc.data() }))
          .filter((d: any) => d.donorId === effectiveUserId && d.status === 'available');

        logger.info(`Checking ${existingDonationsData.length} existing donations for duplicates`);
      } catch (e) {
        existingDonationsData = [];
      }

      // Run ML duplicate detection
      if (existingDonationsData.length > 0) {
        try {
          const { detectDuplicateDonation, quickDuplicateCheck } = require('../backend/services/duplicateDetection');

          // Quick check first (fast)
          const quickCheck = quickDuplicateCheck(
            formData.title,
            existingDonationsData.map((d: any) => d.title)
          );

          if (quickCheck.isDuplicate) {
            const similarity = Math.round(quickCheck.similarity * 100);
            Toast.show({
              type: 'error',
              text1: 'Duplicate Donation',
              text2: `${similarity}% match with "${quickCheck.match}". Please post something different.`,
              visibilityTime: 5000,
            });
            setIsSubmitting(false);
            return;
          }

          // Full ML check (comprehensive)
          const duplicateCheck = detectDuplicateDonation(
            {
              title: formData.title,
              description: formData.description,
              location: formData.location,
              foodType: formData.foodType
            },
            existingDonationsData,
            0.55  // 55% threshold for ensemble detection
          );

          if (duplicateCheck.isDuplicate) {
            const match = duplicateCheck.duplicates[0] || duplicateCheck.allSimilarities[0];
            const similarity = Math.round((match?.similarity || duplicateCheck.highestSimilarity) * 100);
            Toast.show({
              type: 'error',
              text1: 'Similar Donation Found',
              text2: `${similarity}% similar to "${match?.title || 'existing donation'}". ML detected duplicate.`,
              visibilityTime: 5000,
            });
            setIsSubmitting(false);
            return;
          }

          logger.info('✅ No duplicates detected by ML');
        } catch (mlError) {
          logger.error('ML detection error:', mlError);
          // Fallback: simple exact match check
          const exactMatch = existingDonationsData.find(
            (d: any) => d.title?.toLowerCase().trim() === formData.title.toLowerCase().trim()
          );
          if (exactMatch) {
            Toast.show({
              type: 'error',
              text1: 'Duplicate Donation',
              text2: `You already have "${exactMatch.title}". Please post something different.`,
              visibilityTime: 5000,
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 3. PROCEED TO GATEKEEPER
      await performFinalSubmission(effectiveUserId, effectiveUser);

    } catch (error: any) {
      logger.error('Submit error', error);
      let errorMessage = 'Failed to post donation';
      let errorTitle = 'Error';

    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleSubmit = async () => {
  //   if (!validateStep2()) {
  //     Toast.show({
  //       type: 'error',
  //       text1: 'Validation Error',
  //       text2: 'Please fill in all required fields',
  //     });
  //     return;
  //   }

  //   // Set loading state
  //   setIsSubmitting(true);

  //   try {
  //     // Import donation service
  //     const donationService = require('../services/donationService').default;

  //     // Prepare donation data for backend
  //     const donationData = {
  //       title: formData.title,
  //       description: formData.description,
  //       servings: parseInt(formData.servings),
  //       bestBefore: formData.bestBefore.toISOString(),
  //       pickupTime: formData.pickupTime.toISOString(),
  //       location: formData.location,
  //       coordinates: { lat: 40.7128, lng: -74.0060 },
  //       specialInstructions: formData.specialInstructions,
  //       images: formData.images,
  //       isVegetarian: formData.isVegetarian,
  //       isVegan: formData.isVegan,
  //       isHalal: formData.isHalal,
  //       allergens: formData.allergens,
  //     };

  //     // Call backend API (AI/ML validation runs automatically!)
  //     const result = await donationService.createDonation(donationData);

  //     if (!result.success) {
  //       // Show error message
  //       Toast.show({
  //         type: 'error',
  //         text1: 'Error',
  //         text2: result.message || 'Failed to create donation. Please check backend connection.',
  //         visibilityTime: 4000,
  //       });
  //       return;
  //     }

  //     // Check if AI rejected due to expiry
  //     if (result.aiInsights?.expiryValidation && !result.aiInsights.expiryValidation.valid) {
  //       Toast.show({
  //         type: 'error',
  //         text1: 'Invalid Expiry',
  //         text2: result.aiInsights.expiryValidation.warnings.join('. '),
  //         visibilityTime: 4000,
  //       });
  //       return;
  //     }

  //     // Check ML duplicate detection results
  //     if (result.mlInsights?.duplicateCheck?.isDuplicate) {
  //       const similarity = Math.round(result.mlInsights.duplicateCheck.similarity * 100);

  //       // Show styled duplicate modal
  //       setDuplicateInfo({
  //         similarity,
  //         existingDonation: {
  //           foodType: result.mlInsights.duplicateCheck.duplicates[0]?.title,
  //           postedDate: new Date(result.mlInsights.duplicateCheck.duplicates[0]?.createdAt).toLocaleDateString(),
  //         }
  //       });
  //       setPendingDonationData(result);
  //       setShowDuplicateModal(true);
  //       return;
  //     }

  //     // Success - show AI/ML insights
  //     finalizeDonation(result);

  //   } catch (error: any) {
  //     logger.error('Submit error', error);
  //     Toast.show({
  //       type: 'error',
  //       text1: 'Connection Error',
  //       text2: 'Cannot connect to backend. Please ensure backend is running.',
  //       visibilityTime: 5000,
  //     });
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  const handleDuplicateCancel = () => {
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingDonationData(null);
    setIsSubmitting(false);
    Toast.show({
      type: 'info',
      text1: 'Cancelled',
      text2: 'Donation not posted',
    });
  };

  const handleDuplicateConfirm = async () => {
    setShowDuplicateModal(false);

    const auth = require('@react-native-firebase/auth').default;
    const currentUser = auth().currentUser;
    const effectiveUser = currentUser || user;
    const effectiveUserId = effectiveUser?.uid || effectiveUser?.id;

    if (effectiveUserId) {
      setIsSubmitting(true);
      await performFinalSubmission(effectiveUserId, effectiveUser);
    }

    setDuplicateInfo(null);
    setPendingDonationData(null);
  };

  const finalizeDonation = (result: any) => {
    // Build success message with AI/ML insights
    let insightsMessage = 'Donation posted successfully!';

    if (result.aiInsights?.categorization) {
      insightsMessage += `\n🤖 AI: ${result.aiInsights.categorization.suggested}`;
    }

    if (result.aiInsights?.expiryValidation) {
      const urgency = result.aiInsights.expiryValidation.urgency;
      insightsMessage += `\n⏰ Urgency: ${urgency.toUpperCase()}`;
    }

    if (result.mlInsights?.duplicateCheck && !result.mlInsights.duplicateCheck.isDuplicate) {
      insightsMessage += '\n✅ No duplicates found';
    }

    Toast.show({
      type: 'success',
      text1: 'Success!',
      text2: insightsMessage,
      visibilityTime: 5000,
    });

    // Add notification
    addNotification({
      id: Date.now(),
      type: 'donation',
      title: 'Donation Posted',
      message: `Your ${formData.title} is now available for pickup`,
      timestamp: new Date().toISOString(),
      read: false,
      urgent: false,
    });

    // Reset form and navigate
    resetForm();
    setTimeout(() => {
      navigation.navigate('MyDonations');
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Food Donation</Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressSteps}>
          <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepText, currentStep >= 1 && styles.stepTextActive]}>1</Text>
          </View>
          <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
          <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepText, currentStep >= 2 && styles.stepTextActive]}>2</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 1 ? (
          <View style={styles.stepContainer}>
            {/* Food Details Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Food Details</Text>
              <Text style={styles.cardSubtitle}>Tell us about the food you're sharing</Text>

              {/* Food Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Food Title *</Text>
                <View style={[styles.inputContainer, errors.title && styles.inputError]}>
                  <Icon name="fast-food-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    style={styles.textInput}
                    value={formData.title}
                    onChangeText={(text) => {
                      setFormData(prev => ({ ...prev, title: text }));
                      if (safetyRisk) setSafetyRisk(null);
                    }}
                    placeholder="e.g., Fresh homemade lasagna"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.description}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, description: text }));
                    if (safetyRisk) setSafetyRisk(null);
                  }}
                  placeholder="Describe the food, how it was prepared, etc."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Food Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Food Category *</Text>
                <View style={[
                  styles.pickerContainer,
                  errors.foodType && { borderColor: colors.destructive, borderWidth: 1, padding: 8, borderRadius: borderRadius.md }
                ]}>
                  {foodTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerOption,
                        formData.foodType === type && styles.pickerOptionActive,
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, foodType: type }))}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          formData.foodType === type && styles.pickerOptionTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.foodType && <Text style={styles.errorText}>{errors.foodType}</Text>}
              </View>

              {/* Servings */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Servings *</Text>
                <View style={[styles.inputContainer, errors.servings && styles.inputError]}>
                  <Icon name="people-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    style={styles.textInput}
                    value={formData.servings}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, servings: text }))}
                    placeholder="How many people?"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
                {errors.servings && <Text style={styles.errorText}>{errors.servings}</Text>}
              </View>

              {/* Best Before */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Best Before *</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, errors.bestBefore && styles.inputError]}
                  onPress={openBestBeforePicker}
                >
                  <Icon name="calendar-outline" size={20} color={colors.mutedForeground} />
                  <Text style={styles.dateText}>{formatDateTime(formData.bestBefore)}</Text>
                  <Icon name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
                {errors.bestBefore && <Text style={styles.errorText}>{errors.bestBefore}</Text>}
              </View>
            </View>

            {/* Dietary Information Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dietary Information</Text>
              <Text style={styles.cardSubtitle}>Help people with dietary restrictions find suitable food</Text>

              {/* Dietary Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dietary Type *</Text>
                <View style={[
                  styles.dietaryTypeContainer,
                  errors.dietaryType && { borderColor: colors.destructive, borderWidth: 1, padding: 8, borderRadius: borderRadius.md }
                ]}>
                  {dietaryTypes.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.dietaryTypeOption,
                        formData.dietaryType === type.value && styles.dietaryTypeOptionActive,
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, dietaryType: type.value as any }))}
                    >
                      <Text style={[
                        styles.dietaryTypeLabel,
                        formData.dietaryType === type.value && styles.dietaryTypeLabelActive,
                      ]}>
                        {type.label}
                      </Text>
                      <Text style={[
                        styles.dietaryTypeDesc,
                        formData.dietaryType === type.value && styles.dietaryTypeDescActive,
                      ]}>
                        {type.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.dietaryType && <Text style={styles.errorText}>{errors.dietaryType}</Text>}
              </View>

              {/* Spice Level - Hide for sweets/bakery */}
              {formData.dietaryType !== 'sweets-bakery' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Spice Level</Text>
                  <View style={styles.spiceLevelContainer}>
                    {spiceLevels.map(level => (
                      <TouchableOpacity
                        key={level.value}
                        style={[
                          styles.spiceLevelOption,
                          formData.spiceLevel === level.value && { backgroundColor: level.color },
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, spiceLevel: level.value as any }))}
                      >
                        <Text style={[
                          styles.spiceLevelText,
                          formData.spiceLevel === level.value && styles.spiceLevelTextActive,
                        ]}>
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Allergy Safety Chart */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Allergy Safety Chart</Text>
                  <TouchableOpacity
                    style={styles.aiScanBtn}
                    onPress={handleAllergenScan}
                    disabled={analyzingAllergens}
                  >
                    {analyzingAllergens ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Icon name="scan-outline" size={14} color={colors.primary} />
                        <Text style={styles.aiScanText}>AI Scan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <AllergyChart
                  selectedAllergens={formData.allergens}
                  horizontal={false}
                />

                <View style={styles.allergenSelector}>
                  {ALLERGENS.slice(0, 8).map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.allergenBadge,
                        formData.allergens.includes(a.id) && styles.allergenBadgeActive
                      ]}
                      onPress={() => {
                        const newAllergens = formData.allergens.includes(a.id)
                          ? formData.allergens.filter(id => id !== a.id)
                          : [...formData.allergens, a.id];
                        setFormData(prev => ({ ...prev, allergens: newAllergens }));
                      }}
                    >
                      <Text style={[
                        styles.allergenBadgeText,
                        formData.allergens.includes(a.id) && styles.allergenBadgeTextActive
                      ]}>
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.moreText}>+ {ALLERGENS.length - 8} more... use AI scan to detect all</Text>
                </View>
              </View>

              {/* Ingredients / Content Details */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ingredients (Optional)</Text>
                <TextInput
                  style={styles.textAreaSmall}
                  value={formData.ingredients}
                  onChangeText={(text) => {
                    setFormData(prev => ({ ...prev, ingredients: text }));
                    if (safetyRisk) setSafetyRisk(null);
                  }}
                  placeholder="e.g., Wheat, Dairy, Peanuts, Sugar..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>

              {/* Food Source */}
              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <Text style={styles.label}>Food Source</Text>
                <View style={styles.checkboxGroup}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setFormData(prev => ({ ...prev, isHomemade: !prev.isHomemade }))}
                  >
                    <Icon
                      name={formData.isHomemade ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={formData.isHomemade ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={styles.checkboxLabel}>Homemade</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {safetyRisk && (
                <View style={[styles.safetyAlert, safetyRisk.level === 'high' && styles.safetyAlertHigh]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
                      <Icon name="alert-circle" size={18} color={colors.destructive} />
                      <Text style={[styles.safetyAlertText, { fontFamily: typography.fontFamily.bold }]}>
                        Safety Rejection: {safetyRisk.reason}
                      </Text>
                    </View>

                    {safetyRisk.risks && safetyRisk.risks.length > 0 && (
                      <View style={{ marginLeft: 22, marginBottom: 8 }}>
                        {safetyRisk.risks.map((risk, idx) => (
                          <Text key={idx} style={[styles.safetyAlertText, { fontSize: 12 }]}>• {risk}</Text>
                        ))}
                      </View>
                    )}

                    {safetyRisk.advice && (
                      <View style={{
                        backgroundColor: colors.white,
                        padding: spacing.sm,
                        borderRadius: borderRadius.sm,
                        marginTop: spacing.xs,
                        borderLeftWidth: 3,
                        borderLeftColor: colors.primary
                      }}>
                        <Text style={{
                          fontSize: 12,
                          color: colors.foreground,
                          fontFamily: typography.fontFamily.semibold,
                          marginBottom: 2
                        }}>
                          💡 How to fix:
                        </Text>
                        <Text style={{
                          fontSize: 12,
                          color: colors.mutedForeground,
                          fontFamily: typography.fontFamily.regular
                        }}>
                          {safetyRisk.advice}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, padding: spacing.xs }}
                      onPress={() => setFormData(prev => ({ ...prev, ignoreSafetyRisk: !prev.ignoreSafetyRisk }))}
                    >
                      <Icon
                        name={formData.ignoreSafetyRisk ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={formData.ignoreSafetyRisk ? colors.destructive : colors.mutedForeground}
                      />
                      <Text style={{
                        marginLeft: spacing.xs,
                        fontSize: 12,
                        color: colors.foreground,
                        flex: 1,
                        fontFamily: typography.fontFamily.medium
                      }}>
                        I understand the risks, but this food is safe. Proceed anyway.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Safety Confirmation Checkbox */}
              <View style={[
                styles.safetyConfirmationContainer,
                errors.isSafetyConfirmed && { backgroundColor: `${colors.destructive}10`, borderColor: colors.destructive, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm }
              ]}>
                <TouchableOpacity
                  style={styles.safetyCheckbox}
                  onPress={() => setFormData(prev => ({ ...prev, isSafetyConfirmed: !prev.isSafetyConfirmed }))}
                >
                  <Icon
                    name={formData.isSafetyConfirmed ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={formData.isSafetyConfirmed ? colors.success : (errors.isSafetyConfirmed ? colors.destructive : colors.mutedForeground)}
                  />
                  <Text style={[
                    styles.safetyCheckboxLabel,
                    errors.isSafetyConfirmed && { color: colors.destructive }
                  ]}>
                    I confirm this food is fresh, within its best-before date, and 100% safe for consumption.
                  </Text>
                </TouchableOpacity>
                {errors.isSafetyConfirmed && <Text style={[styles.errorText, { marginTop: spacing.xs }]}>{errors.isSafetyConfirmed}</Text>}
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stepContainer}>
            {/* Pickup Details Card */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Icon name="time-outline" size={20} color={colors.foreground} />
                <Text style={[styles.cardTitle, { marginLeft: spacing.sm, marginBottom: 0 }]}>Pickup Details</Text>
              </View>

              {/* Pickup Time */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Available for Pickup *</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, errors.pickupTime && styles.inputError]}
                  onPress={openPickupTimePicker}
                >
                  <Icon name="calendar-outline" size={20} color={colors.mutedForeground} />
                  <Text style={styles.dateText}>{formatDateTime(formData.pickupTime)}</Text>
                  <Icon name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
                {errors.pickupTime && <Text style={styles.errorText}>{errors.pickupTime}</Text>}
              </View>

              {/* Pickup Location */}
              <View style={[styles.inputGroup, { zIndex: 2000 }]}>
                <Text style={styles.label}>Pickup Location *</Text>
                <AddressAutocomplete
                  value={formData.location}
                  onAddressSelect={(address, coords) => {
                    setFormData(prev => ({
                      ...prev,
                      location: address,
                      coordinates: coords || prev.coordinates
                    }));
                  }}
                  placeholder="Enter pickup address"
                  error={!!errors.location}
                />
                {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
              </View>

              {/* Special Instructions */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Special Instructions</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.specialInstructions}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, specialInstructions: text }))}
                  placeholder="Any special handling instructions, parking info, etc."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Photo Upload */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Upload Photos (Optional)</Text>
              <Text style={styles.cardSubtitle}>Add up to 3 photos of your food</Text>

              <View style={styles.imageGrid}>
                {formData.images.map((uri, index) => (
                  <View key={index} style={styles.imagePreview}>
                    <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Icon name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {formData.images.length < 3 && (
                  <>
                    <TouchableOpacity style={styles.imageUploadButton} onPress={handleCameraCapture}>
                      <Icon name="camera" size={32} color={colors.primary} />
                      <Text style={styles.imageUploadText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageUploadButton} onPress={handleImagePick}>
                      <Icon name="images-outline" size={32} color={colors.primary} />
                      <Text style={styles.imageUploadText}>From Gallery</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Safety Notice */}
            <View style={styles.warningCard}>
              <Icon name="warning-outline" size={20} color="#F59E0B" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Food Safety Reminder</Text>
                <Text style={styles.warningText}>
                  Please ensure food is safe for consumption and follow proper food handling guidelines.
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCurrentStep(1)}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1, opacity: isSubmitting ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Text style={[styles.primaryButtonText, { marginRight: spacing.xs }]}>Checking...</Text>
                    <Icon name="hourglass-outline" size={20} color={colors.white} />
                  </>
                ) : (
                  <>
                    <Icon name="checkmark-circle-outline" size={20} color={colors.white} />
                    <Text style={[styles.primaryButtonText, { marginLeft: spacing.xs }]}>Post Donation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Date/Time Picker Modals */}
      <Modal
        visible={showBestBeforePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBestBeforePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Best Before Date & Time</Text>

            <View style={styles.dateTimeDisplay}>
              <Text style={styles.dateTimeText}>{formatDateTime(tempDate)}</Text>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Date</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustDate(-1)}>
                  <Icon name="remove" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{formatDate(tempDate)}</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustDate(1)}>
                  <Icon name="add" size={24} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Time (Hours)</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustTime(-1)}>
                  <Icon name="remove" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{formatTime(tempDate)}</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustTime(1)}>
                  <Icon name="add" size={24} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Minutes</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(-15)}>
                  <Text style={styles.pickerButtonText}>-15</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(-5)}>
                  <Text style={styles.pickerButtonText}>-5</Text>
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{tempDate.getMinutes()} min</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(5)}>
                  <Text style={styles.pickerButtonText}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(15)}>
                  <Text style={styles.pickerButtonText}>+15</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowBestBeforePicker(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmBestBefore}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPickupTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPickupTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Pickup Date & Time</Text>

            <View style={styles.dateTimeDisplay}>
              <Text style={styles.dateTimeText}>{formatDateTime(tempDate)}</Text>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Date</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustDate(-1)}>
                  <Icon name="remove" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{formatDate(tempDate)}</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustDate(1)}>
                  <Icon name="add" size={24} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Time (Hours)</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustTime(-1)}>
                  <Icon name="remove" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{formatTime(tempDate)}</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustTime(1)}>
                  <Icon name="add" size={24} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pickerControls}>
              <Text style={styles.pickerLabel}>Minutes</Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(-15)}>
                  <Text style={styles.pickerButtonText}>-15</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(-5)}>
                  <Text style={styles.pickerButtonText}>-5</Text>
                </TouchableOpacity>
                <Text style={styles.pickerValue}>{tempDate.getMinutes()} min</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(5)}>
                  <Text style={styles.pickerButtonText}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerButton} onPress={() => adjustMinutes(15)}>
                  <Text style={styles.pickerButtonText}>+15</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPickupTimePicker(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmPickupTime}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duplicate Detection Modal */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={handleDuplicateCancel}
      >
        <View style={styles.duplicateModalOverlay}>
          <View style={styles.duplicateModalContent}>
            <View style={styles.duplicateIconContainer}>
              <Icon name="warning" size={48} color="#F59E0B" />
            </View>

            <Text style={styles.duplicateModalTitle}>Duplicate Detected</Text>

            <Text style={styles.duplicateModalMessage}>
              This donation is {duplicateInfo?.similarity}% similar to your existing donation:
            </Text>

            <View style={styles.duplicateInfoCard}>
              <Text style={styles.duplicateInfoTitle}>
                "{duplicateInfo?.existingDonation?.foodType}"
              </Text>
              <Text style={styles.duplicateInfoDate}>
                Posted: {duplicateInfo?.existingDonation?.postedDate}
              </Text>
            </View>

            <Text style={styles.duplicateModalQuestion}>
              Do you still want to add it?
            </Text>

            <View style={styles.duplicateModalButtons}>
              <TouchableOpacity
                style={styles.duplicateCancelButton}
                onPress={handleDuplicateCancel}
              >
                <Text style={styles.duplicateCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.duplicateConfirmButton}
                onPress={handleDuplicateConfirm}
              >
                <Text style={styles.duplicateConfirmText}>Add Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Recommendations Modal */}
      <Modal
        visible={showRecommendationsModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Icon name="sparkles" size={24} color="#8B5CF6" />
              <Text style={styles.modalTitle}>Top Recommended NGOs</Text>
            </View>
            <Text style={styles.recommendationSubtitle}>
              Our AI found these NGOs as the best matches for your donation.
            </Text>

            <ScrollView style={{ maxHeight: 400, width: '100%' }}>
              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <Text style={styles.recName}>{rec.ngoName}</Text>
                    {index === 0 && <View style={styles.bestMatchBadge}><Text style={styles.bestMatchText}>Best Match</Text></View>}
                  </View>
                  <View style={styles.recStats}>
                    <Text style={styles.recScore}>Score: {rec.score}</Text>
                    <Text style={styles.recDistance}>{rec.distanceKm} km away</Text>
                  </View>
                  <Text style={styles.recReason}>{rec.reason}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalConfirmButton, { width: '100%', marginTop: spacing.lg }]}
              onPress={() => {
                setShowRecommendationsModal(false);
                resetForm();
                navigation.navigate('MyDonations');
              }}
            >
              <Text style={styles.modalConfirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    paddingTop: 40,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.mutedForeground,
  },
  stepTextActive: {
    color: colors.white,
  },
  progressLine: {
    width: 80,
    height: 2,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.sm,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  stepContainer: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    padding: 0,
  },
  textArea: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
  },
  dateText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.destructive,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pickerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerOptionText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.white,
  },
  checkboxGroup: {
    gap: spacing.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
  dietaryTypeContainer: {
    gap: spacing.sm,
  },
  dietaryTypeOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dietaryTypeOptionActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  dietaryTypeLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  dietaryTypeLabelActive: {
    color: colors.primary,
  },
  dietaryTypeDesc: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  dietaryTypeDescActive: {
    color: colors.primary,
  },
  spiceLevelContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  spiceLevelOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  spiceLevelText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  spiceLevelTextActive: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  imageUploadButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  imageUploadText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningContent: {
    flex: 1,
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#92400E',
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#92400E',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateTimeDisplay: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
  },
  pickerControls: {
    gap: spacing.sm,
  },
  pickerLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  pickerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pickerButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  pickerValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  // Duplicate Modal Styles
  duplicateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  duplicateModalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
  },
  duplicateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  duplicateModalTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  duplicateModalMessage: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
  },
  duplicateInfoCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  duplicateInfoTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  duplicateInfoDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  duplicateModalQuestion: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  duplicateModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.md,
  },
  duplicateCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  duplicateCancelText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  duplicateConfirmButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  duplicateConfirmText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  aiScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  aiScanText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  allergenSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  allergenBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allergenBadgeActive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  allergenBadgeText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.medium,
  },
  allergenBadgeTextActive: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  moreText: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.regular,
    width: '100%',
    marginTop: 2,
  },
  textAreaSmall: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  safetyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    marginTop: spacing.md,
  },
  safetyAlertHigh: {
    backgroundColor: `${colors.destructive}10`,
    borderColor: `${colors.destructive}30`,
  },
  safetyAlertText: {
    flex: 1,
    fontSize: 13,
    color: colors.destructive,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 18,
  },
  safetyConfirmationContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safetyCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  safetyCheckboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 20,
  },
  recCard: {
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  bestMatchBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  bestMatchText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    color: '#D97706',
  },
  recStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  recScore: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  recDistance: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
  },
  recReason: {
    fontSize: typography.fontSize.sm,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  recommendationSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    textAlign: 'center',
  }
});
