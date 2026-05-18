import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    TextInput
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';

interface AdminNGOVerificationsProps {
    navigation: any;
}

export const AdminNGOVerifications: React.FC<AdminNGOVerificationsProps> = ({ navigation }) => {
    const [applications, setApplications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [selectedAppForRejection, setSelectedAppForRejection] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        const unsubscribe = firestore()
            .collection('ngoVerification')
            .where('status', '==', 'pending')
            .onSnapshot((snapshot) => {
                if (!snapshot) return;
                const apps = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setApplications(apps);
                setIsLoading(false);
            }, (error) => {
                console.error('Error fetching verifications:', error);
                setIsLoading(false);
            });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (app: any) => {
        Alert.alert(
            'Approve Verification',
            `Are you sure you want to approve ${app.organizationName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    style: 'default',
                    onPress: async () => {
                        setProcessingId(app.id);
                        try {
                            const batch = firestore().batch();

                            // Update ngoVerification doc
                            const verifyRef = firestore().collection('ngoVerification').doc(app.id);
                            batch.update(verifyRef, {
                                status: 'approved',
                                verified: true,
                                verifiedAt: firestore.FieldValue.serverTimestamp(),
                            });

                            // Update user doc
                            const userRef = firestore().collection('users').doc(app.id);
                            batch.update(userRef, {
                                verificationStatus: 'approved',
                                ngoVerified: true,
                            });

                            // Send Notification
                            const notificationRef = firestore().collection('notifications').doc();
                            batch.set(notificationRef, {
                                userId: app.id,
                                title: 'Verification Approved',
                                message: 'Congratulations! Your NGO verification has been approved.',
                                type: 'verification_approved',
                                read: false,
                                createdAt: firestore.FieldValue.serverTimestamp(),
                            });

                            await batch.commit();

                            Toast.show({
                                type: 'success',
                                text1: 'Approved',
                                text2: `${app.organizationName} has been verified.`
                            });
                        } catch (error) {
                            console.error(error);
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to approve application' });
                        } finally {
                            setProcessingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleRejectClick = (app: any) => {
        setSelectedAppForRejection(app);
        setRejectionReason('');
        setRejectionModalVisible(true);
    };

    const submitRejection = async () => {
        if (!selectedAppForRejection) return;

        const app = selectedAppForRejection;
        const reason = rejectionReason.trim() || 'Does not meet criteria for verification at this time.';

        setProcessingId(app.id);
        setRejectionModalVisible(false);

        try {
            const batch = firestore().batch();

            // Update ngoVerification doc
            const verifyRef = firestore().collection('ngoVerification').doc(app.id);
            batch.update(verifyRef, {
                status: 'rejected',
                rejectionReason: reason,
                updatedAt: new Date().toISOString()
            });

            // Update user doc
            const userRef = firestore().collection('users').doc(app.id);
            batch.update(userRef, {
                verificationStatus: 'rejected',
                ngoVerified: false,
            });

            // Send Notification
            const notificationRef = firestore().collection('notifications').doc();
            batch.set(notificationRef, {
                userId: app.id,
                title: 'Verification Rejected',
                message: `Your NGO application was rejected. Reason: ${reason}`,
                type: 'verification_rejected',
                read: false,
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            await batch.commit();

            Toast.show({
                type: 'info',
                text1: 'Rejected',
                text2: `${app.organizationName} has been rejected.`
            });
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to reject application' });
        } finally {
            setProcessingId(null);
            setSelectedAppForRejection(null);
            setRejectionReason('');
        }
    };

    const openDocument = async (uri: string) => {
        try {
            // Check if it's a local file URI but we're on a different device
            if (uri.startsWith('file://') || uri.startsWith('content://')) {
                // If it's a local URI, we can try to open it, but warn if it fails
                Toast.show({
                    type: 'info',
                    text1: 'Opening Document',
                    text2: 'Attempting to open local file. This requires the file to be on your device.'
                });
            }

            const supported = await Linking.canOpenURL(uri);
            if (supported) {
                await Linking.openURL(uri);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Cannot Open',
                    text2: 'To view applicant documents across devices, Firebase Storage must be implemented.'
                });
            }
        } catch {
            Toast.show({
                type: 'error',
                text1: 'Cannot Open',
                text2: 'File may not exist on this device. Use Firebase Storage to sync.'
            });
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Icon name="arrow-back" size={24} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Pending Verifications</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {applications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="checkmark-circle-outline" size={64} color={colors.mutedForeground} />
                        <Text style={styles.emptyText}>No pending NGO applications</Text>
                    </View>
                ) : (
                    applications.map(app => (
                        <Card key={app.id} style={styles.card}>
                            <View style={styles.appHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.orgName}>{app.organizationName}</Text>
                                    <Text style={styles.contactDetails}>{app.contactPerson} • {app.email}</Text>
                                    <Text style={styles.contactDetails}>{app.phone}</Text>
                                </View>
                                <Badge text="Pending" variant="warning" />
                            </View>

                            <View style={styles.detailsBox}>
                                <Text style={styles.detailLabel}>Reg Number: <Text style={styles.detailValue}>{app.registrationNumber}</Text></Text>
                                <Text style={styles.detailLabel}>Tax ID: <Text style={styles.detailValue}>{app.taxId}</Text></Text>
                                <Text style={styles.detailLabel}>Address: <Text style={styles.detailValue}>{app.address}</Text></Text>
                            </View>

                            <Text style={styles.sectionTitle}>Documents ({app.documents?.length || 0})</Text>
                            {app.documents?.map((doc: any, index: number) => (
                                <TouchableOpacity key={index} style={styles.documentItem} onPress={() => openDocument(doc.uri)}>
                                    <Icon name="document-text" size={20} color={colors.primary} />
                                    <Text style={styles.documentName} numberOfLines={1}>{doc.name}</Text>
                                </TouchableOpacity>
                            ))}

                            <View style={styles.actionsRow}>
                                <Button
                                    title="Reject"
                                    variant="destructive"
                                    onPress={() => handleRejectClick(app)}
                                    disabled={processingId === app.id}
                                    loading={processingId === app.id}
                                    style={styles.actionBtn}
                                />
                                <Button
                                    title="Approve"
                                    variant="primary"
                                    onPress={() => handleApprove(app)}
                                    disabled={processingId === app.id}
                                    loading={processingId === app.id}
                                    style={styles.actionBtn}
                                />
                            </View>
                        </Card>
                    ))
                )}
            </ScrollView>

            <Modal
                visible={rejectionModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRejectionModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Reject Application</Text>
                            <TouchableOpacity onPress={() => setRejectionModalVisible(false)}>
                                <Icon name="close" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Please provide a reason for rejecting {selectedAppForRejection?.organizationName}. This will be sent to the NGO.
                        </Text>

                        <TextInput
                            style={styles.textInput}
                            multiline
                            numberOfLines={4}
                            placeholder="Reason for rejection (e.g., Missing documents, invalid Tax ID)"
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <Button
                                title="Cancel"
                                variant="outline"
                                onPress={() => setRejectionModalVisible(false)}
                                style={{ flex: 1, marginRight: spacing.sm }}
                            />
                            <Button
                                title="Confirm Reject"
                                variant="destructive"
                                onPress={submitRejection}
                                style={{ flex: 1 }}
                            />
                        </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: spacing.md,
    },
    headerTitle: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.semibold,
        color: colors.foreground,
    },
    content: {
        padding: spacing.base,
        paddingBottom: spacing.xl,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.mutedForeground,
    },
    card: {
        marginBottom: spacing.base,
    },
    appHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    orgName: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.foreground,
        marginBottom: 4,
    },
    contactDetails: {
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
    },
    detailsBox: {
        backgroundColor: colors.muted,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginVertical: spacing.sm,
    },
    detailLabel: {
        fontSize: typography.fontSize.xs,
        fontFamily: typography.fontFamily.semibold,
        color: colors.foreground,
    },
    detailValue: {
        fontFamily: typography.fontFamily.regular,
        color: colors.mutedForeground,
    },
    sectionTitle: {
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily.semibold,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    documentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
    },
    documentName: {
        marginLeft: spacing.sm,
        fontSize: typography.fontSize.sm,
        color: colors.primary,
        flex: 1,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    actionBtn: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    modalContainer: {
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.fontSize.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.foreground,
    },
    modalSubtitle: {
        fontSize: typography.fontSize.sm,
        color: colors.mutedForeground,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    textInput: {
        backgroundColor: colors.muted,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        fontSize: typography.fontSize.base,
        color: colors.foreground,
        minHeight: 100,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    }
});
