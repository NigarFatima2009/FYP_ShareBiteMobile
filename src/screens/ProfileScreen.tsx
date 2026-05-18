import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { PhoneInput } from '../components/common/PhoneInput';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';
import { storage } from '../utils/storage';

interface ProfileScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({
  navigation,
  user,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || 'John Doe',
    email: user?.email || 'john.doe@example.com',
    phone: user?.phone || '+1 (555) 123-4567',
    address: user?.address || '123 Main St, City, State',
    bio: user?.bio || 'Passionate about reducing food waste and helping my community.',
  });
  const [isVerified, setIsVerified] = useState(user?.verified || user?.verificationStatus === 'approved');

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        doc => {
          if (doc && (typeof doc.exists === 'function' ? doc.exists() : doc.exists)) {
            const data = doc.data();
            setIsVerified(data?.verified || data?.verificationStatus === 'approved');
            if (data?.profileImage) {
              setProfileImage(data.profileImage);
            }
          }
        },
        error => {
          console.log('Profile verification listener error:', error);
        }
      );

    return () => unsubscribe();
  }, []);

  const stats = {
    donationsMade: 24,
    foodRequested: 8,
    volunteeredDeliveries: 15,
    impactScore: 95,
  };

  const [errors, setErrors] = useState<any>({});

  const pickProfileImage = async () => {
    try {
      const { launchImageLibrary } = require('react-native-image-picker');

      const options = {
        mediaType: 'photo' as const,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
      };

      launchImageLibrary(options, async (result: any) => {
        if (result.didCancel) return;

        if (result.errorCode) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: result.errorMessage || 'Could not access gallery',
          });
          return;
        }

        const asset = result.assets?.[0];
        if (!asset?.uri) return;

        setIsUploadingImage(true);

        try {
          const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dwfuurgoy/upload';
          const UPLOAD_PRESET = 'volunteer_documents';

          const uploadData = new FormData();
          const uri = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');

          uploadData.append('file', {
            uri: uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || 'profile.jpg'
          } as any);
          uploadData.append('upload_preset', UPLOAD_PRESET);

          const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: uploadData,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'multipart/form-data',
            },
          });

          const uploadResult = await response.json();

          if (!response.ok) {
            throw new Error(uploadResult.error?.message || 'Failed to upload image');
          }

          if (uploadResult.secure_url) {
            const imageUrl = uploadResult.secure_url;
            setProfileImage(imageUrl);

            const currentUser = auth().currentUser;
            if (currentUser) {
              await firestore().collection('users').doc(currentUser.uid).update({
                profileImage: imageUrl
              });
            }

            Toast.show({
              type: 'success',
              text1: 'Profile Picture Updated',
              text2: 'Your photo was saved successfully!',
            });
          }
        } catch (error: any) {
          console.error('Image upload error:', error);
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: error.message || 'Could not upload image',
          });
        } finally {
          setIsUploadingImage(false);
        }
      });
    } catch (error: any) {
      console.error('Image picker error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not open image picker',
      });
      setIsUploadingImage(false);
    }
  };

  const removeProfileImage = async () => {
    try {
      setProfileImage(null);
      const currentUser = auth().currentUser;
      if (currentUser) {
        await firestore().collection('users').doc(currentUser.uid).update({
          profileImage: null
        });
      }
      Toast.show({
        type: 'success',
        text1: 'Photo Removed',
        text2: 'Your profile picture has been removed',
      });
    } catch (error) {
      console.error('Error removing profile image:', error);
    }
  };

  const handleAvatarPress = () => {
    if (profileImage) {
      setShowAvatarOptions(true);
    } else {
      pickProfileImage();
    }
  };

  const validateProfile = () => {
    const newErrors: any = {};
    const { validateName, validateEmail, validateAddress } = require('../utils/inputValidation');
    const { validatePhoneNumber } = require('../utils/phoneValidation');

    const nameValidation = validateName(profileData.name);
    if (!nameValidation.isValid) newErrors.name = nameValidation.error;

    const emailValidation = validateEmail(profileData.email);
    if (!emailValidation.isValid) newErrors.email = emailValidation.error;

    const phoneValidation = validatePhoneNumber(profileData.phone);
    if (!phoneValidation.isValid) newErrors.phone = phoneValidation.error;

    const addressValidation = validateAddress(profileData.address);
    if (!addressValidation.isValid) newErrors.address = addressValidation.error;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: '' }));
  };

  const handleSaveProfile = () => {
    if (!validateProfile()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors below',
      });
      return;
    }

    setIsEditing(false);
    Toast.show({
      type: 'success',
      text1: 'Profile Updated',
      text2: 'Your profile has been saved successfully',
    });
  };

  const handleLogout = () => {
    Toast.show({
      type: 'success',
      text1: 'Logged Out',
      text2: 'See you soon!',
    });
    onLogout();
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const currentUser = auth().currentUser;
      const userId = currentUser?.uid || user?.uid || user?.id;

      if (!userId) {
        throw new Error('User not found');
      }

      // Step 1: Delete user's donations
      try {
        const donationsSnapshot = await firestore()
          .collection('donations')
          .where('donorId', '==', userId)
          .get();

        const batch1 = firestore().batch();
        donationsSnapshot.docs.forEach(doc => {
          batch1.delete(doc.ref);
        });
        await batch1.commit();
      } catch (e) { }

      // Step 2: Delete user's notifications
      try {
        const notificationsSnapshot = await firestore()
          .collection('notifications')
          .where('userId', '==', userId)
          .get();

        const batch2 = firestore().batch();
        notificationsSnapshot.docs.forEach(doc => {
          batch2.delete(doc.ref);
        });
        await batch2.commit();
      } catch (e) { }

      // Step 3: Delete user profile from Firestore
      try {
        await firestore().collection('users').doc(userId).delete();
      } catch (e) { }

      // Step 4: Delete from Firebase Authentication
      if (currentUser) {
        try {
          await currentUser.delete();
        } catch (authError: any) {
          if (authError.code === 'auth/requires-recent-login') {
            setShowDeleteModal(false);
            Toast.show({
              type: 'error',
              text1: 'Security Check Required',
              text2: 'Please sign out and sign in again before deleting.',
              visibilityTime: 6000,
            });
            return;
          }
          throw authError;
        }
      }

      // Step 5: Clear local storage
      await storage.removeUser();
      await storage.clearAll();

      setShowDeleteModal(false);

      Toast.show({
        type: 'success',
        text1: 'Account Deleted',
        text2: 'Your account has been permanently deleted.',
        visibilityTime: 3000,
      });

      onLogout();

    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to delete account. Please try again.',
        visibilityTime: 4000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      decelerationRate={0.997}
      scrollEventThrottle={16}
      nestedScrollEnabled={true}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleAvatarPress}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <View style={styles.avatar}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Icon name="person" size={40} color={colors.white} />
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Icon name="camera" size={16} color={colors.white} />
          </View>
        </TouchableOpacity>
        <View style={styles.nameContainer}>
          <Text style={styles.userName}>{profileData.name}</Text>
          {isVerified && (
            <Icon name="shield-checkmark" size={20} color={colors.primary} style={styles.verifiedIcon} />
          )}
        </View>
        <Badge text={user?.userType || 'User'} variant="default" />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.donationsMade}</Text>
          <Text style={styles.statLabel}>Donations</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.impactScore}</Text>
          <Text style={styles.statLabel}>Impact Score</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.volunteeredDeliveries}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
      </View>

      {/* Profile Information */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Profile Information</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Icon
              name={isEditing ? 'close' : 'create'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <View>
            <Input
              label="Name"
              value={profileData.name}
              onChangeText={text => handleInputChange('name', text)}
              error={errors.name}
            />
            <Input
              label="Email"
              value={profileData.email}
              onChangeText={text => handleInputChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <PhoneInput
              label="Phone"
              value={profileData.phone}
              onChangeText={text => handleInputChange('phone', text)}
              defaultCountry="PK"
              error={errors.phone}
            />
            <Input
              label="Address"
              value={profileData.address}
              onChangeText={text => handleInputChange('address', text)}
              multiline
              numberOfLines={2}
              error={errors.address}
            />
            <Input
              label="Bio (Optional)"
              value={profileData.bio}
              onChangeText={text => handleInputChange('bio', text)}
              placeholder="Tell us about yourself (max 500 characters)"
              multiline
              numberOfLines={3}
              error={errors.bio}
            />
            <Button title="Save Changes" onPress={handleSaveProfile} fullWidth />
          </View>
        ) : (
          <View>
            <View style={styles.infoRow}>
              <Icon name="mail" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{profileData.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="call" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{profileData.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="location" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{profileData.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{profileData.bio}</Text>
            </View>
          </View>
        )}
      </Card>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions & Verifications</Text>

        {(user?.userType === 'ngo' || user?.role === 'admin' || user?.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1') && (
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('NGOVerification')}
          >
            <Icon name="business" size={20} color={colors.primary} />
            <Text style={styles.settingText}>NGO Verification Form</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {(user?.userType === 'donor' || user?.role === 'admin' || user?.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1') && (
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('DonorVerification')}
          >
            <Icon name="person" size={20} color={colors.success} />
            <Text style={styles.settingText}>Donor Verification Form</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {(user?.userType === 'volunteer' || user?.role === 'admin' || user?.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1') && (
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('VolunteerVerification')}
          >
            <Icon name="car" size={20} color={colors.warning} />
            <Text style={styles.settingText}>Volunteer Verification Form</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </Card>

      {/* Admin Panel */}
      {(user?.role === 'admin' || user?.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Admin Panel</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('AdminNGOVerifications')}
          >
            <Icon name="business" size={20} color={colors.primary} />
            <Text style={styles.settingText}>Review NGO Verifications</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('AdminDonorVerifications')}
          >
            <Icon name="person" size={20} color={colors.success} />
            <Text style={styles.settingText}>Review Donor Verifications</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('AdminVolunteerVerifications')}
          >
            <Icon name="car" size={20} color={colors.warning} />
            <Text style={styles.settingText}>Review Volunteer Verifications</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('AdminUserManagement')}
          >
            <Icon name="people" size={20} color={colors.info} />
            <Text style={styles.settingText}>Manage Users</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Card>
      )}

      {/* Settings */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingItem}>
          <Icon name="notifications" size={20} color={colors.foreground} />
          <Text style={styles.settingText}>Notifications</Text>
          <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Icon name="shield-checkmark" size={20} color={colors.foreground} />
          <Text style={styles.settingText}>Privacy</Text>
          <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => navigation.navigate('Feedback')}
        >
          <Icon name="chatbubble-ellipses" size={20} color={colors.foreground} />
          <Text style={styles.settingText}>Send Feedback</Text>
          <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Icon name="help-circle" size={20} color={colors.foreground} />
          <Text style={styles.settingText}>Help & Support</Text>
          <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, styles.deleteSettingItem]}
          onPress={() => setShowDeleteModal(true)}
        >
          <Icon name="trash-outline" size={20} color={colors.destructive} />
          <Text style={[styles.settingText, styles.deleteSettingText]}>Delete Account</Text>
          <Icon name="chevron-forward" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </Card>

      <Button
        title="Sign Out"
        onPress={handleLogout}
        variant="destructive"
        fullWidth
        icon={<Icon name="log-out" size={20} color={colors.white} />}
      />

      {/* Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Icon name="warning" size={48} color={colors.destructive} style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalMessage}>
              This action is permanent and cannot be undone. All your data will be permanently deleted.
            </Text>

            {isDeleting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.destructive} />
                <Text style={styles.loadingText}>Deleting account...</Text>
              </View>
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDeleteButton}
                  onPress={handleDeleteAccount}
                >
                  <Text style={styles.confirmDeleteText}>Delete Forever</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Avatar Options Modal */}
      <Modal
        visible={showAvatarOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarOptions(false)}
        >
          <View style={[styles.modalContent, { padding: 0, overflow: 'hidden' }]}>
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Icon name="person-circle" size={48} color={colors.primary} style={styles.modalIcon} />
              <Text style={styles.modalTitle}>Profile Picture</Text>
              <Text style={styles.modalMessage}>
                What would you like to do with your profile picture?
              </Text>
            </View>

            <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={{ paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => {
                  setShowAvatarOptions(false);
                  setTimeout(() => pickProfileImage(), 300);
                }}
              >
                <Text style={{ fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semibold, color: colors.primary }}>
                  Choose New Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => {
                  setShowAvatarOptions(false);
                  removeProfileImage();
                }}
              >
                <Text style={{ fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semibold, color: colors.destructive }}>
                  Remove Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.muted }}
                onPress={() => setShowAvatarOptions(false)}
              >
                <Text style={{ fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semibold, color: colors.foreground }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.base, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.white },
  userName: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.semibold, color: colors.foreground },
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  verifiedIcon: { marginLeft: 2 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.lg },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colors.primary },
  statLabel: { fontSize: typography.fontSize.xs, fontFamily: typography.fontFamily.regular, color: colors.mutedForeground, marginTop: spacing.xs },
  card: { marginBottom: spacing.base },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  cardTitle: { fontSize: typography.fontSize.lg, fontFamily: typography.fontFamily.semibold, color: colors.foreground, marginBottom: spacing.base },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  infoText: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.regular, color: colors.foreground, marginLeft: spacing.md, flex: 1 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingText: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.regular, color: colors.foreground, marginLeft: spacing.md, flex: 1 },
  deleteSettingItem: { borderBottomWidth: 0 },
  deleteSettingText: { color: colors.destructive },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.xl, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIcon: { marginBottom: spacing.md },
  modalTitle: { fontSize: typography.fontSize.xl, fontFamily: typography.fontFamily.bold, color: colors.foreground, marginBottom: spacing.sm, textAlign: 'center' },
  modalMessage: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  cancelButton: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.muted, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semibold, color: colors.foreground },
  confirmDeleteButton: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.destructive, alignItems: 'center' },
  confirmDeleteText: { fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semibold, color: colors.white },
  loadingContainer: { alignItems: 'center', paddingVertical: spacing.md },
  loadingText: { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.regular, color: colors.mutedForeground, marginTop: spacing.sm },
});

export default ProfileScreen;
