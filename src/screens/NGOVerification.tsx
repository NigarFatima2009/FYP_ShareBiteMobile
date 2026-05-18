import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { PhoneInput } from '../components/common/PhoneInput';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { validateOrganizationName, validateName, validateAddress, validateEmail } from '../utils/inputValidation';
import { validatePhoneNumber } from '../utils/phoneValidation';
import { TEST_SCENARIOS, loadTestData } from '../testData/mockNGOVerificationData';

interface NGOVerificationProps {
  navigation: any;
  user: any;
  addNotification: (notification: any) => void;
}

type VerificationStatus = 'not_started' | 'pending' | 'verified' | 'rejected';
type TabType = 'apply' | 'status' | 'info';

interface VerificationStepData {
  applicationSubmitted: boolean;
  applicationSubmittedDate: string | null;
  documentReview: boolean;
  documentReviewDate: string | null;
  backgroundCheck: boolean;
  backgroundCheckDate: string | null;
  finalApproval: boolean;
  finalApprovalDate: string | null;
}

export const NGOVerification: React.FC<NGOVerificationProps> = ({
  navigation,
  user,
  addNotification,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('apply');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('not_started');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errors, setErrors] = useState<any>({});
  const [formData, setFormData] = useState({
    organizationName: '',
    registrationNumber: '',
    taxId: '',
    address: '',
    website: '',
    contactPerson: '',
    phone: '',
    email: '',
    description: '',
    servicesProvided: '',
    documents: [] as Array<{ name: string; uri: string; type: string; size: number }>,
  });
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStepData>({
    applicationSubmitted: false,
    applicationSubmittedDate: null,
    documentReview: false,
    documentReviewDate: null,
    backgroundCheck: false,
    backgroundCheckDate: null,
    finalApproval: false,
    finalApprovalDate: null,
  });

  // Load existing verification data on mount and listen for changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setIsLoadingData(false);
        return;
      }

      // Set up real-time listener for verification data
      unsubscribe = firestore()
        .collection('ngoVerification')
        .doc(currentUser.uid)
        .onSnapshot(
          (doc) => {
            console.log('NGO Verification snapshot received, exists:', doc.exists);

            if (doc.exists()) {
              const data = doc.data();
              console.log('Loaded verification data:', JSON.stringify(data, null, 2));

              // Set form data from saved data ONLY ON INITIAL LOAD or if it's not being edited
              setFormData(prev => {
                // If we already have local unsaved changes, we might not want to overwrite them, 
                // but since it's a draft, we can merge or use the Firebase data if prev is empty.
                const shouldUpdate = prev.organizationName === '' && !prev.documents.length;
                if (!shouldUpdate && data?.status === 'draft') return prev;

                return {
                  organizationName: data?.organizationName || prev.organizationName || '',
                  registrationNumber: data?.registrationNumber || prev.registrationNumber || '',
                  taxId: data?.taxId || prev.taxId || '',
                  address: data?.address || prev.address || '',
                  website: data?.website || prev.website || '',
                  contactPerson: data?.contactPerson || prev.contactPerson || '',
                  phone: data?.phone || prev.phone || '',
                  email: data?.email || prev.email || '',
                  description: data?.description || prev.description || '',
                  servicesProvided: data?.servicesProvided || prev.servicesProvided || '',
                  documents: data?.documents && data.documents.length > 0 ? data.documents : prev.documents,
                };
              });

              // Set verification status
              if (data?.status === 'approved' || data?.verified) {
                setVerificationStatus('verified');
                setActiveTab('status');
              } else if (data?.status === 'rejected') {
                setVerificationStatus('rejected');
                // Load rejection reason if available
                if (data?.rejectionReason) {
                  setRejectionReason(data.rejectionReason);
                }
                setActiveTab('status');
              } else if (data?.status === 'pending') {
                setVerificationStatus('pending');
                setActiveTab('status');
              } else {
                // Draft or no status - keep as not_started but preserve data
                setVerificationStatus('not_started');
              }

              // Load verification steps from Firebase
              const isVerified = data?.status === 'approved' || data?.verified;
              const isPending = data?.status === 'pending';
              const submittedDate = data?.submittedAt && typeof data.submittedAt.toDate === 'function'
                ? data.submittedAt.toDate().toLocaleDateString()
                : data?.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : null;
              const reviewedDate = (data?.verifiedAt || data?.reviewedAt) && typeof (data.verifiedAt || data?.reviewedAt).toDate === 'function'
                ? (data.verifiedAt || data?.reviewedAt).toDate().toLocaleDateString()
                : (data?.verifiedAt || data?.reviewedAt) ? new Date(data.verifiedAt || data?.reviewedAt).toLocaleDateString() : null;

              setVerificationSteps({
                applicationSubmitted: isPending || isVerified,
                applicationSubmittedDate: submittedDate,
                documentReview: isVerified,
                documentReviewDate: isVerified ? reviewedDate : null,
                backgroundCheck: isVerified,
                backgroundCheckDate: isVerified ? reviewedDate : null,
                finalApproval: isVerified,
                finalApprovalDate: isVerified ? reviewedDate : null,
              });
            } else {
              console.log('No verification document found for user');
              // Document doesn't exist yet - reset to defaults
              setVerificationStatus('not_started');
            }
            setIsLoadingData(false);
          },
          (error) => {
            console.error('Error listening to verification:', error);
            setIsLoadingData(false);
          }
        );
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Auto-save draft data to Firestore
  const saveDraftToFirestore = async (data: typeof formData) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Only save if there's some data to save
      if (!data.organizationName && !data.registrationNumber && data.documents.length === 0) {
        return;
      }

      await firestore()
        .collection('ngoVerification')
        .doc(currentUser.uid)
        .set({
          ngoId: currentUser.uid,
          ngoEmail: currentUser.email,
          organizationName: data.organizationName,
          registrationNumber: data.registrationNumber,
          taxId: data.taxId,
          address: data.address,
          website: data.website,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email,
          description: data.description,
          servicesProvided: data.servicesProvided,
          documents: data.documents,
          status: 'draft',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (error) {
      // Silent error - don't interrupt user
      console.log('Auto-save error:', error);
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    // Don't auto-save if status is already pending/verified/rejected
    if (verificationStatus !== 'not_started') return;

    const timeoutId = setTimeout(() => {
      saveDraftToFirestore(formData);
    }, 1500); // Save after 1.5 seconds of no changes

    return () => clearTimeout(timeoutId);
  }, [formData, verificationStatus]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDocumentPick = async () => {
    try {
      const remainingSlots = 5 - formData.documents.length;
      if (remainingSlots <= 0) {
        Toast.show({ type: 'error', text1: 'Maximum Reached' });
        return;
      }

      const result = await pick({
        type: [types.pdf, types.images, types.doc, types.docx],
        allowMultiSelection: true,
      });

      const selectedFiles = Array.isArray(result) ? result : [result];
      const newDocuments = selectedFiles.map((file: any) => ({
        name: file.name || `Document_${Date.now()}`,
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
      }));

      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...newDocuments].slice(0, 5),
      }));
    } catch (err) {
      if (isErrorWithCode(err) && err.code !== errorCodes.OPERATION_CANCELED) {
        Toast.show({ type: 'error', text1: 'Upload Failed' });
      }
    }
  };

  const removeDocument = async (index: number) => {
    const updatedDocuments = formData.documents.filter((_, i) => i !== index);

    setFormData(prev => ({
      ...prev,
      documents: updatedDocuments,
    }));

    // Immediately save to Firestore
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        await firestore()
          .collection('ngoVerification')
          .doc(currentUser.uid)
          .set({
            documents: updatedDocuments,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
      }
    } catch (error) {
      // Silent error
    }

    Toast.show({
      type: 'info',
      text1: 'Document Removed',
      text2: 'Document has been removed',
    });
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('image')) return 'image';
    if (type.includes('word') || type.includes('doc')) return 'document';
    return 'document-attach';
  };

  const loadTestScenario = async (scenario: keyof typeof TEST_SCENARIOS) => {
    const testData = loadTestData(scenario);

    setFormData({
      organizationName: testData.formData.organizationName,
      registrationNumber: testData.formData.registrationNumber,
      taxId: testData.formData.taxId,
      address: testData.formData.address,
      website: testData.formData.website || '',
      contactPerson: testData.formData.contactPerson,
      phone: testData.formData.phone,
      email: testData.formData.email,
      description: testData.formData.description,
      servicesProvided: testData.formData.servicesProvided || '',
      documents: testData.formData.documents,
    });

    // Save to Firestore
    const currentUser = auth().currentUser;
    if (currentUser) {
      await firestore()
        .collection('ngoVerification')
        .doc(currentUser.uid)
        .set({
          ngoId: currentUser.uid,
          ngoEmail: currentUser.email,
          ...testData.formData,
          status: 'draft',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
    }

    Toast.show({
      type: 'success',
      text1: 'Test Data Loaded',
      text2: `Expected: ${testData.expected.result}`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validateForm = () => {
    const newErrors: any = {};

    // Organization name validation
    const orgNameValidation = validateOrganizationName(formData.organizationName);
    if (!orgNameValidation.isValid) {
      newErrors.organizationName = orgNameValidation.error;
    }

    // Registration number validation
    if (!formData.registrationNumber.trim()) {
      newErrors.registrationNumber = 'Registration number is required';
    } else if (formData.registrationNumber.trim().length < 3) {
      newErrors.registrationNumber = 'Registration number must be at least 3 characters';
    }

    // Tax ID validation
    if (!formData.taxId.trim()) {
      newErrors.taxId = 'Tax ID is required';
    }

    // Address validation
    const addressValidation = validateAddress(formData.address);
    if (!addressValidation.isValid) {
      newErrors.address = addressValidation.error;
    }

    // Contact person validation
    const contactValidation = validateName(formData.contactPerson);
    if (!contactValidation.isValid) {
      newErrors.contactPerson = contactValidation.error;
    }

    // Phone validation
    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.isValid) {
      newErrors.phone = phoneValidation.error;
    }

    // Email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error;
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Organization description is required';
    } else if (formData.description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    // Documents validation - at least 1 document required
    if (formData.documents.length === 0) {
      newErrors.documents = 'At least one document is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors below',
      });
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please log in to submit verification',
        });
        setIsLoading(false);
        return;
      }

      const now = new Date().toISOString();

      // Ensure we have documents to upload
      if (!formData.documents || formData.documents.length === 0) {
        throw new Error('No documents found to upload');
      }

      Toast.show({
        type: 'info',
        text1: 'Uploading Documents',
        text2: 'Please wait while we upload your files to Cloudinary...',
        visibilityTime: 4000,
      });

      // Upload documents to Cloudinary
      const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dwfuurgoy/upload';
      const UPLOAD_PRESET = 'ngo_documents'; // Must be an unsigned preset

      const uploadedDocs = await Promise.all(
        formData.documents.map(async (doc) => {
          // If the document is already a Cloudinary URL (e.g. from a previous draft load), skip upload
          if (doc.uri.startsWith('http')) {
            return doc;
          }

          // Create FormData for Cloudinary
          const uploadData = new FormData();
          uploadData.append('file', {
            uri: doc.uri,
            type: doc.type || 'application/octet-stream',
            name: doc.name,
          } as any);
          uploadData.append('upload_preset', UPLOAD_PRESET);

          try {
            const response = await fetch(CLOUDINARY_URL, {
              method: 'POST',
              body: uploadData,
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
              },
            });

            const result = await response.json();

            if (!response.ok) {
              console.error('Cloudinary error:', result);
              throw new Error(result.error?.message || 'Failed to upload to Cloudinary');
            }

            return {
              ...doc,
              uri: result.secure_url // Replace local URI with remote URL
            };
          } catch (err: any) {
            console.error('Upload Error:', err);
            throw new Error(`Failed to upload ${doc.name}: ${err.message}`);
          }
        })
      );

      // Save verification data to Firestore
      const verificationData = {
        ngoId: currentUser.uid,
        ngoEmail: currentUser.email,
        organizationName: formData.organizationName,
        registrationNumber: formData.registrationNumber,
        taxId: formData.taxId,
        address: formData.address,
        website: formData.website,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        description: formData.description,
        servicesProvided: formData.servicesProvided,
        documents: uploadedDocs,
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
      };

      // Save to ngoVerification collection
      await firestore()
        .collection('ngoVerification')
        .doc(currentUser.uid)
        .set(verificationData, { merge: true });

      // Update user document with verification status
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          verificationStatus: 'pending',
          ngoVerified: false, // Ensure they are not auto-verified
          organizationName: formData.organizationName,
        });

      setFormData(prev => ({
        ...prev,
        documents: uploadedDocs
      }));

      setVerificationStatus('pending');
      setSubmittedAt(now);
      setActiveTab('status');

      // Update verification steps state
      setVerificationSteps({
        applicationSubmitted: true,
        applicationSubmittedDate: new Date(now).toLocaleDateString(),
        documentReview: false,
        documentReviewDate: null,
        backgroundCheck: false,
        backgroundCheckDate: null,
        finalApproval: false,
        finalApprovalDate: null,
      });

      Toast.show({
        type: 'info',
        text1: 'AI Verification Started',
        text2: 'Analyzing your documents... (2-3 minutes)',
      });

      console.log('Verification application submitted for manual review');

      // Always require admin approval - NO AUTO-APPROVAL
      Toast.show({
        type: 'success',
        text1: 'Application Submitted!',
        text2: 'Your application is pending admin review. You will be notified once reviewed.',
        visibilityTime: 5000,
      });

      addNotification({
        type: 'verification_submitted',
        title: 'Application Submitted',
        message: 'Your NGO verification application has been submitted for admin review.',
      });

    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to submit verification',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return { icon: 'checkmark-circle', color: colors.primary, text: 'Verified', bg: `${colors.primary}20` };
      case 'pending':
        return { icon: 'time', color: '#F59E0B', text: 'Pending', bg: '#FEF3C7' };
      case 'rejected':
        return { icon: 'close-circle', color: colors.destructive, text: 'Rejected', bg: '#FEE2E2' };
      default:
        return { icon: 'information-circle', color: colors.mutedForeground, text: 'Not Started', bg: colors.muted };
    }
  };

  const renderTabButton = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderApplicationForm = () => (
    <ScrollView>
      {/* Welcome Message for First-Time NGO Users */}
      {verificationStatus === 'not_started' && !formData.organizationName && (
        <Card style={[styles.card, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <Icon name="information-circle" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: '#1E40AF', marginBottom: spacing.xs }}>
                Welcome to ShareBite!
              </Text>
              <Text style={{ fontSize: typography.fontSize.sm, color: '#1E3A8A', lineHeight: 20 }}>
                To access all NGO features and start receiving food donations, please complete the verification process below. This helps us ensure the safety and legitimacy of all organizations on our platform.
              </Text>
            </View>
          </View>
        </Card>
      )}


      {/* Benefits Card */}
      <Card style={styles.card}>
        <View style={styles.benefitsHeader}>
          <Icon name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.benefitsTitle}>NGO Verification Benefits</Text>
        </View>
        <Text style={styles.benefitsSubtitle}>
          Get verified to gain trust and access special features
        </Text>
        <View style={styles.benefitsGrid}>
          <View style={[styles.benefitItem, { backgroundColor: `${colors.primary}20` }]}>
            <Icon name="shield-checkmark" size={24} color={colors.primary} />
            <Text style={styles.benefitTitle}>Trusted Status</Text>
            <Text style={styles.benefitText}>Verified badge on profile</Text>
          </View>
          <View style={[styles.benefitItem, { backgroundColor: '#DBEAFE' }]}>
            <Icon name="flash" size={24} color={colors.primary} />
            <Text style={styles.benefitTitle}>Priority Access</Text>
            <Text style={styles.benefitText}>Faster donation matching</Text>
          </View>
        </View>
      </Card>

      {/* Organization Information */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Organization Information</Text>

        <Input
          label="Organization Name"
          value={formData.organizationName}
          onChangeText={text => handleInputChange('organizationName', text)}
          placeholder="Enter organization name"
          error={errors.organizationName}
          editable={!isLoading}
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Input
              label="Registration Number"
              value={formData.registrationNumber}
              onChangeText={text => handleInputChange('registrationNumber', text)}
              placeholder="NPO registration"
              error={errors.registrationNumber}
              editable={!isLoading}
            />
          </View>
          <View style={styles.halfWidth}>
            <Input
              label="Tax ID / EIN"
              value={formData.taxId}
              onChangeText={text => handleInputChange('taxId', text)}
              placeholder="Tax ID"
              error={errors.taxId}
              editable={!isLoading}
            />
          </View>
        </View>

        <Input
          label="Mission & Description"
          value={formData.description}
          onChangeText={text => handleInputChange('description', text)}
          placeholder="Describe your organization's mission and activities (minimum 20 characters)"
          multiline
          numberOfLines={4}
          error={errors.description}
          editable={!isLoading}
        />

        <Input
          label="Services Provided"
          value={formData.servicesProvided}
          onChangeText={text => handleInputChange('servicesProvided', text)}
          placeholder="e.g., Food Distribution, Emergency Assistance"
          multiline
          numberOfLines={2}
          editable={!isLoading}
        />
      </Card>

      {/* Contact Information */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Contact Information</Text>

        <Input
          label="Address"
          value={formData.address}
          onChangeText={text => handleInputChange('address', text)}
          placeholder="Enter organization address (minimum 10 characters)"
          multiline
          numberOfLines={2}
          error={errors.address}
          editable={!isLoading}
        />

        <Input
          label="Website (Optional)"
          value={formData.website}
          onChangeText={text => handleInputChange('website', text)}
          placeholder="www.yourorganization.org"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <Input
          label="Contact Person"
          value={formData.contactPerson}
          onChangeText={text => handleInputChange('contactPerson', text)}
          placeholder="Enter contact person name"
          error={errors.contactPerson}
          editable={!isLoading}
        />

        <Input
          label="Email"
          value={formData.email}
          onChangeText={text => handleInputChange('email', text)}
          placeholder="organization@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
          editable={!isLoading}
        />

        <PhoneInput
          label="Phone Number"
          value={formData.phone}
          onChangeText={text => handleInputChange('phone', text)}
          error={errors.phone}
          defaultCountry="PK"
          editable={!isLoading}
        />
      </Card>

      {/* Required Documents */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Required Documents</Text>
        {errors.documents && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={styles.errorText}>{errors.documents}</Text>
          </View>
        )}
        <View style={styles.uploadBox}>
          <Icon name="cloud-upload-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.uploadText}>Upload verification documents (PDF, DOC, Images)</Text>
          <Text style={styles.uploadSubtext}>Maximum 5 files, 5MB each</Text>
          <Button
            title={`Choose Files (${formData.documents.length}/5)`}
            onPress={handleDocumentPick}
            variant="outline"
            disabled={formData.documents.length >= 5}
          />
        </View>

        {/* Uploaded Documents List */}
        {formData.documents.length > 0 && (
          <View style={styles.uploadedDocuments}>
            <Text style={styles.uploadedTitle}>Uploaded Documents:</Text>
            {formData.documents.map((doc, index) => (
              <View key={index} style={styles.documentCard}>
                <Icon name={getFileIcon(doc.type)} size={24} color={colors.primary} />
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.documentSize}>{formatFileSize(doc.size)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeDocument(index)}
                  style={styles.removeDocButton}
                >
                  <Icon name="close-circle" size={24} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.documentList}>
          <Text style={styles.documentListTitle}>Required documents:</Text>
          <Text style={styles.documentItem}>• Certificate of Incorporation or Registration</Text>
          <Text style={styles.documentItem}>• Tax-Exempt Status Certificate (if applicable)</Text>
          <Text style={styles.documentItem}>• Board of Directors List</Text>
          <Text style={styles.documentItem}>• Recent Financial Statement or Annual Report</Text>
          <Text style={styles.documentItem}>• Government-issued ID of contact person</Text>
        </View>
      </Card>

      {/* Auto-save indicator */}
      <View style={styles.autoSaveIndicator}>
        <Icon name="cloud-done" size={16} color={colors.success} />
        <Text style={styles.autoSaveText}>Your progress is automatically saved</Text>
      </View>

      <View style={styles.submitButton}>
        <Button
          title={isLoading ? 'Submitting...' : 'Submit Verification Application'}
          onPress={handleSubmit}
          disabled={isLoading}
          loading={isLoading}
          fullWidth
        />
      </View>
    </ScrollView>
  );

  const renderStatusTab = () => {
    const steps = [
      {
        step: 'Application Submitted',
        completed: verificationSteps.applicationSubmitted,
        date: verificationSteps.applicationSubmittedDate,
        description: 'Your verification application has been received',
      },
      {
        step: 'Document Review',
        completed: verificationSteps.documentReview,
        date: verificationSteps.documentReviewDate,
        description: 'All required documents have been reviewed',
      },
      {
        step: 'Background Check',
        completed: verificationSteps.backgroundCheck,
        date: verificationSteps.backgroundCheckDate,
        description: 'Organization background verification completed',
      },
      {
        step: 'Final Approval',
        completed: verificationSteps.finalApproval,
        date: verificationSteps.finalApprovalDate,
        description: 'Verification process completed successfully',
      },
    ];

    return (
      <ScrollView>
        {/* Estimated Time Card */}
        {verificationStatus === 'pending' && (
          <Card style={[styles.card, { backgroundColor: '#FEF3C7' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="time" size={24} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.fontSize.base, fontWeight: '600', color: '#92400E' }}>
                  Estimated Verification Time
                </Text>
                <Text style={{ fontSize: typography.fontSize.sm, color: '#B45309' }}>
                  24-48 hours (Manual review process)
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Verification Progress</Text>
          <Text style={styles.subtitle}>Track the status of your verification application</Text>

          <View style={styles.stepsContainer}>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={[
                  styles.stepIcon,
                  { backgroundColor: step.completed ? colors.success : colors.muted }
                ]}>
                  {step.completed ? (
                    <Icon name="checkmark" size={16} color={colors.white} />
                  ) : (
                    <View style={styles.stepDot} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepTitle,
                    { color: step.completed ? colors.foreground : colors.mutedForeground }
                  ]}>
                    {step.step}
                  </Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  {step.date && (
                    <Text style={styles.stepDate}>{step.date}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>

        {verificationStatus === 'verified' && (
          <Card style={[styles.card, styles.verifiedCard]}>
            <View style={styles.verifiedContent}>
              <View style={styles.verifiedIconContainer}>
                <Icon name="shield-checkmark" size={32} color={colors.success} />
              </View>
              <View style={styles.verifiedTextContainer}>
                <Text style={styles.verifiedTitle}>Verification Complete</Text>
                <Text style={styles.verifiedText}>
                  Your organization is now verified. Valid until {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {verificationStatus === 'rejected' && (
          <Card style={[styles.card, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
            <View style={styles.verifiedContent}>
              <View style={[styles.verifiedIconContainer, { backgroundColor: '#FEE2E2' }]}>
                <Icon name="close-circle" size={32} color="#EF4444" />
              </View>
              <View style={styles.verifiedTextContainer}>
                <Text style={[styles.verifiedTitle, { color: '#991B1B' }]}>Application Rejected</Text>
                <Text style={[styles.verifiedText, { color: '#7F1D1D' }]}>
                  Your application has been reviewed and rejected by the admin.
                </Text>
                {rejectionReason && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#EF4444' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#991B1B', marginBottom: 4 }}>
                      Reason for Rejection:
                    </Text>
                    <Text style={{ fontSize: 14, color: '#7F1D1D', lineHeight: 20 }}>
                      {rejectionReason}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 13, color: '#7F1D1D', marginTop: 12, fontStyle: 'italic' }}>
                  Please review the reason above, make necessary corrections, and reapply.
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: '#EF4444', padding: 14, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={() => {
                    setVerificationStatus('not_started');
                    setRejectionReason('');
                    setActiveTab('apply');
                    Toast.show({
                      type: 'info',
                      text1: 'Ready to Reapply',
                      text2: 'Please correct the issues mentioned above and submit again',
                    });
                  }}
                >
                  <Icon name="refresh" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Reapply for Verification</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    );
  };

  const renderInfoTab = () => (
    <ScrollView>
      <Card style={styles.card}>
        <View style={styles.orgHeader}>
          <View style={styles.orgHeaderLeft}>
            <Icon name="business" size={24} color={colors.primary} />
            <View style={styles.orgHeaderText}>
              <Text style={styles.orgName}>{formData.organizationName || 'Your Organization'}</Text>
              <Text style={styles.orgType}>Non-Profit Organization</Text>
            </View>
          </View>
          {verificationStatus === 'verified' && (
            <View style={styles.verifiedBadge}>
              <Icon name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Registration Number</Text>
            <Text style={styles.infoValue}>{formData.registrationNumber || 'N/A'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Verified Since</Text>
            <Text style={styles.infoValue}>
              {verificationStatus === 'verified' && verifiedAt
                ? new Date(verifiedAt).toLocaleDateString()
                : verificationStatus === 'verified'
                  ? 'Verified'
                  : 'Not verified'}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.contactItem}>
          <Icon name="mail" size={20} color={colors.mutedForeground} />
          <Text style={styles.contactText}>{formData.email || 'No email provided'}</Text>
        </View>
        <View style={styles.contactItem}>
          <Icon name="call" size={20} color={colors.mutedForeground} />
          <Text style={styles.contactText}>{formData.phone || 'No phone provided'}</Text>
        </View>
        {formData.website && (
          <View style={styles.contactItem}>
            <Icon name="globe" size={20} color={colors.mutedForeground} />
            <Text style={styles.contactText}>{formData.website}</Text>
          </View>
        )}
      </Card>

      {formData.servicesProvided && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Services Offered</Text>
          <Text style={styles.servicesText}>{formData.servicesProvided}</Text>
        </Card>
      )}
    </ScrollView>
  );

  const statusBadge = getStatusBadge();

  // Show loading indicator while data is being loaded
  if (isLoadingData) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>NGO Verification</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading verification data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NGO Verification</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Icon name={statusBadge.icon} size={16} color={statusBadge.color} />
          <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTabButton('apply', 'Apply')}
        {renderTabButton('status', 'Status')}
        {renderTabButton('info', 'Organization')}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'apply' && renderApplicationForm()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'info' && renderInfoTab()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.mutedForeground,
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  tabContent: {
    flex: 1,
    padding: spacing.base,
  },
  card: {
    marginBottom: spacing.base,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  benefitsTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  benefitsSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  benefitsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  benefitItem: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  benefitTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  benefitText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  uploadText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  uploadSubtext: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  uploadedDocuments: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  uploadedTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  documentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  documentName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  documentSize: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  removeDocButton: {
    padding: spacing.xs,
  },
  documentList: {
    marginTop: spacing.sm,
  },
  documentListTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  documentItem: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.destructive + '15',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.destructive,
    flex: 1,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  autoSaveText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.success,
  },
  testDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  testDataButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#8B5CF6',
  },
  stepsContainer: {
    marginTop: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mutedForeground,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  stepDate: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  verifiedCard: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  verifiedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verifiedTextContainer: {
    flex: 1,
  },
  verifiedTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#065F46',
    marginBottom: spacing.xs,
  },
  verifiedText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#047857',
  },
  orgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orgHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orgHeaderText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  orgName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  orgType: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.success,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  contactText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    marginLeft: spacing.md,
  },
  servicesText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
});
