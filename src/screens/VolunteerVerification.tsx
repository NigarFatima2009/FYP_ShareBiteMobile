import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { validateName, validateAddress, validateEmail } from '../utils/inputValidation';
import { validatePhoneNumber } from '../utils/phoneValidation';

interface VolunteerVerificationProps {
    navigation: any;
    user: any;
    addNotification: (notification: any) => void;
}

type VerificationStatus = 'not_started' | 'pending' | 'verified' | 'rejected';
type TabType = 'apply' | 'status' | 'info';

export const VolunteerVerification: React.FC<VolunteerVerificationProps> = ({
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
        fullName: '',
        cnic: '',
        address: '',
        phone: user?.phone || '',
        email: user?.email || '',
        hasVehicle: false,
        vehicleType: '',
        licenseNumber: '',
        documents: [] as Array<{ name: string; uri: string; type: string; size: number }>,
    });
    const [rejectionReason, setRejectionReason] = useState<string>('');

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const setupListener = () => {
            const currentUser = auth().currentUser;
            if (!currentUser) {
                setIsLoadingData(false);
                return;
            }

            // Listen to users collection for verification status
            const unsubUser = firestore()
                .collection('users')
                .doc(currentUser.uid)
                .onSnapshot(doc => {
                    if (doc.exists()) {
                        const data = doc.data();
                        if (data?.verificationStatus === 'approved' || data?.verified) {
                            setVerificationStatus('verified');
                            setActiveTab('status');
                        } else if (data?.verificationStatus === 'rejected') {
                            setVerificationStatus('rejected');
                            setRejectionReason(data?.rejectionReason || '');
                            setActiveTab('status');
                        } else if (data?.verificationStatus === 'pending') {
                            setVerificationStatus('pending');
                            setActiveTab('status');
                        }
                    }
                });

            // Listen to volunteerVerification collection for details
            const unsubVerification = firestore()
                .collection('volunteerVerification')
                .doc(currentUser.uid)
                .onSnapshot(
                    (doc) => {
                        if (doc.exists()) {
                            const data = doc.data();
                            setFormData(prev => ({
                                ...prev,
                                fullName: data?.fullName || prev.fullName,
                                cnic: data?.cnic || prev.cnic,
                                address: data?.address || prev.address,
                                phone: data?.phone || prev.phone,
                                email: data?.email || prev.email,
                                hasVehicle: data?.hasVehicle || prev.hasVehicle,
                                vehicleType: data?.vehicleType || prev.vehicleType,
                                licenseNumber: data?.licenseNumber || prev.licenseNumber,
                                documents: data?.documents || prev.documents,
                            }));

                            if (data?.status === 'approved') {
                                setVerificationStatus('verified');
                                setActiveTab('status');
                            } else if (data?.status === 'rejected') {
                                setVerificationStatus('rejected');
                                setRejectionReason(data?.rejectionReason || '');
                                setActiveTab('status');
                            } else if (data?.status === 'pending') {
                                setVerificationStatus('pending');
                                setActiveTab('status');
                            }
                        }
                        setIsLoadingData(false);
                    },
                    (error) => {
                        console.error('Error listening to volunteer verification:', error);
                        setIsLoadingData(false);
                    }
                );
            
            return () => {
                unsubUser();
                unsubVerification();
            };
        };

        const cleanup = setupListener();

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const formatCNIC = (value: string) => {
        // Remove all non-numeric characters
        const cleaned = value.replace(/\D/g, '');
        
        // Limit to 13 digits
        const limited = cleaned.slice(0, 13);
        
        // Add dashes: XXXXX-XXXXXXX-X
        if (limited.length > 12) {
            return `${limited.slice(0, 5)}-${limited.slice(5, 12)}-${limited.slice(12)}`;
        } else if (limited.length > 5) {
            return `${limited.slice(0, 5)}-${limited.slice(5)}`;
        }
        return limited;
    };

    const handleInputChange = (field: string, value: any) => {
        let finalValue = value;
        if (field === 'cnic' && typeof value === 'string') {
            finalValue = formatCNIC(value);
        }
        
        setFormData(prev => ({ ...prev, [field]: finalValue }));
        if (errors[field]) {
            setErrors((prev: any) => ({ ...prev, [field]: '' }));
        }
    };

    const handleDocumentPick = async () => {
        try {
            const result = await pick({
                type: [types.pdf, types.images],
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

    const validateForm = () => {
        const newErrors: any = {};
        if (!validateName(formData.fullName).isValid) newErrors.fullName = validateName(formData.fullName).error;
        if (!formData.cnic.trim()) newErrors.cnic = 'CNIC/ID is required';
        if (!validateAddress(formData.address).isValid) newErrors.address = validateAddress(formData.address).error;
        if (!validatePhoneNumber(formData.phone).isValid) newErrors.phone = validatePhoneNumber(formData.phone).error;
        if (formData.hasVehicle && !formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required for drivers';
        if (formData.documents.length === 0) newErrors.documents = 'ID and License copies are required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setIsLoading(true);

        try {
            const currentUser = auth().currentUser;
            if (!currentUser) throw new Error('Not authenticated');

            const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dwfuurgoy/upload';
            const UPLOAD_PRESET = 'volunteer_documents';

            const uploadedDocs = await Promise.all(
                formData.documents.map(async (doc) => {
                    if (doc.uri.startsWith('http')) return doc;
                    const uploadData = new FormData();
                    uploadData.append('file', { uri: doc.uri, type: doc.type, name: doc.name } as any);
                    uploadData.append('upload_preset', UPLOAD_PRESET);
                    const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: uploadData });
                    const result = await response.json();
                    return { ...doc, uri: result.secure_url };
                })
            );

            const verificationData = {
                ...formData,
                userId: currentUser.uid,
                documents: uploadedDocs,
                status: 'pending',
                submittedAt: firestore.FieldValue.serverTimestamp(),
            };

            await firestore().collection('volunteerVerification').doc(currentUser.uid).set(verificationData);
            await firestore().collection('users').doc(currentUser.uid).update({ verificationStatus: 'pending' });

            setVerificationStatus('pending');
            setActiveTab('status');
            Toast.show({ type: 'success', text1: 'Application Submitted' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Submission Failed', text2: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color={colors.foreground} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Volunteer Verification</Text>
            </View>

            <View style={styles.tabContainer}>
                {['apply', 'status', 'info'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                        onPress={() => setActiveTab(tab as TabType)}
                    >
                        <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {activeTab === 'apply' && (
                    <View>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Identity Verification</Text>
                            <Input 
                                label="Full Name" 
                                value={formData.fullName} 
                                onChangeText={t => handleInputChange('fullName', t)} 
                                error={errors.fullName} 
                                placeholder={user?.displayName || user?.name || "Ex: John Doe"} 
                            />
                            <Input 
                                label="CNIC (National ID Card Number) *" 
                                value={formData.cnic} 
                                onChangeText={t => handleInputChange('cnic', t)} 
                                error={errors.cnic} 
                                placeholder="12345-1234567-1" 
                                keyboardType="numeric"
                                maxLength={15}
                            />
                            <Input 
                                label="Address" 
                                value={formData.address} 
                                onChangeText={t => handleInputChange('address', t)} 
                                error={errors.address} 
                                placeholder={user?.address || "Enter your full house/office address"} 
                            />
                        </Card>

                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Vehicle & License</Text>
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                onPress={() => handleInputChange('hasVehicle', !formData.hasVehicle)}
                            >
                                <Icon name={formData.hasVehicle ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                                <Text style={styles.checkboxLabel}>I have a vehicle for deliveries</Text>
                            </TouchableOpacity>

                            {formData.hasVehicle && (
                                <>
                                    <Input 
                                        label="Vehicle Type (Bike/Car) *" 
                                        value={formData.vehicleType} 
                                        onChangeText={t => handleInputChange('vehicleType', t)} 
                                        placeholder="Ex: Honda Civic, 70cc Bike" 
                                    />
                                    <Input 
                                        label="Driving License Number *" 
                                        value={formData.licenseNumber} 
                                        onChangeText={t => handleInputChange('licenseNumber', t)} 
                                        error={errors.licenseNumber} 
                                        placeholder="Ex: PB-123456"
                                    />
                                </>
                            )}
                        </Card>

                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Verification Documents</Text>
                            <Text style={styles.subtext}>Please upload clear photos of your CNIC (Front & Back) and your Driving License.</Text>
                            <TouchableOpacity style={styles.uploadBox} onPress={handleDocumentPick}>
                                <Icon name="cloud-upload" size={32} color={colors.primary} />
                                <Text style={styles.uploadText}>Upload CNIC & License Photos</Text>
                            </TouchableOpacity>
                            {formData.documents.map((doc, idx) => (
                                <View key={idx} style={styles.docItem}>
                                    <Icon name="document-text" size={20} color={colors.primary} />
                                    <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                                </View>
                            ))}
                            {errors.documents && <Text style={styles.errorText}>{errors.documents}</Text>}
                        </Card>

                        <Button title="Submit Application" onPress={handleSubmit} loading={isLoading} disabled={isLoading || verificationStatus !== 'not_started'} />
                    </View>
                )}

                {activeTab === 'status' && (
                    <Card style={styles.card}>
                        <View style={styles.statusBox}>
                            <Icon
                                name={verificationStatus === 'verified' ? 'shield-checkmark' : 'time'}
                                size={64}
                                color={verificationStatus === 'verified' ? colors.success : colors.warning}
                            />
                            <Text style={styles.statusTitle}>Verification: {verificationStatus.toUpperCase()}</Text>
                            <Text style={styles.statusDesc}>
                                {verificationStatus === 'verified' ? 'You are now an authorized volunteer!' : 'Review in progress. We will notify you once approved.'}
                            </Text>
                        </View>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.base, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
    headerTitle: { fontSize: typography.fontSize.lg, fontWeight: 'bold', marginLeft: spacing.md },
    tabContainer: { flexDirection: 'row', backgroundColor: colors.white },
    tabButton: { flex: 1, padding: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
    tabButtonActive: { borderColor: colors.primary },
    tabButtonText: { color: colors.mutedForeground },
    tabButtonTextActive: { color: colors.primary, fontWeight: 'bold' },
    content: { padding: spacing.base },
    card: { padding: spacing.md, marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.fontSize.base, fontWeight: 'bold', marginBottom: spacing.md },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    checkboxLabel: { marginLeft: spacing.sm, fontSize: typography.fontSize.base },
    uploadBox: { height: 100, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginVertical: spacing.md },
    uploadText: { color: colors.primary, fontSize: typography.fontSize.sm },
    docItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.muted, borderRadius: 4, marginBottom: spacing.xs },
    docName: { marginLeft: spacing.sm, fontSize: typography.fontSize.xs, flex: 1 },
    subtext: { fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.sm },
    statusBox: { alignItems: 'center', padding: spacing.xl },
    statusTitle: { fontSize: typography.fontSize.lg, fontWeight: 'bold', marginTop: spacing.lg },
    statusDesc: { textAlign: 'center', marginTop: spacing.sm, color: colors.mutedForeground },
    errorText: { color: colors.destructive, fontSize: typography.fontSize.xs },
});
