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
import { colors, spacing } from '../theme';

export const AdminVolunteerVerifications: React.FC<{ navigation: any }> = ({ navigation }) => {
    const [applications, setApplications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
    const [selectedApp, setSelectedApp] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        const unsubscribe = firestore()
            .collection('volunteerVerification')
            .where('status', '==', 'pending')
            .onSnapshot(snap => {
                setApplications(snap ? snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) : []);
                setIsLoading(false);
            });
        return () => unsubscribe();
    }, []);

    const handleApprove = async (app: any) => {
        setProcessingId(app.id);
        try {
            const batch = firestore().batch();
            batch.update(firestore().collection('volunteerVerification').doc(app.id), { status: 'approved', verified: true, verifiedAt: firestore.FieldValue.serverTimestamp() });
            batch.update(firestore().collection('users').doc(app.id), { verificationStatus: 'approved', volunteerVerified: true });
            batch.set(firestore().collection('notifications').doc(), { userId: app.id, title: 'Verified!', message: 'Your volunteer account is verified.', type: 'verification_approved', read: false, createdAt: firestore.FieldValue.serverTimestamp() });
            await batch.commit();
            Toast.show({ type: 'success', text1: 'Approved' });
        } catch (e) { Toast.show({ type: 'error', text1: 'Error' }); }
        finally { setProcessingId(null); }
    };

    const handleReject = async () => {
        if (!selectedApp) return;
        setProcessingId(selectedApp.id);
        try {
            const batch = firestore().batch();
            batch.update(firestore().collection('volunteerVerification').doc(selectedApp.id), { status: 'rejected', rejectionReason, updatedAt: new Date().toISOString() });
            batch.update(firestore().collection('users').doc(selectedApp.id), { verificationStatus: 'rejected' });
            batch.set(firestore().collection('notifications').doc(), { userId: selectedApp.id, title: 'Rejected', message: rejectionReason, type: 'verification_rejected', read: false, createdAt: firestore.FieldValue.serverTimestamp() });
            await batch.commit();
            setRejectionModalVisible(false);
            Toast.show({ type: 'info', text1: 'Rejected' });
        } catch (e) { Toast.show({ type: 'error', text1: 'Error' }); }
        finally { setProcessingId(null); }
    };

    if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color={colors.foreground} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Volunteer Verifications</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {applications.length === 0 ? <Text style={styles.empty}>No pending volunteer applications</Text> : applications.map(app => (
                    <Card key={app.id} style={styles.card}>
                        <Text style={styles.name}>{app.fullName}</Text>
                        <Text style={styles.subText}>{app.email} • {app.phone}</Text>
                        <Text style={styles.subText}>Vehicle: {app.hasVehicle ? app.vehicleType : 'None'}</Text>
                        <Text style={styles.subText}>License: {app.licenseNumber || 'N/A'}</Text>

                        <View style={styles.docList}>
                            {app.documents?.map((doc: any, i: number) => (
                                <TouchableOpacity key={i} style={styles.docItem} onPress={() => Linking.openURL(doc.uri)}>
                                    <Icon name="document-text" size={20} color={colors.primary} />
                                    <Text style={styles.docName}>{doc.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.actions}>
                            <Button title="Reject" variant="destructive" onPress={() => { setSelectedApp(app); setRejectionModalVisible(true); }} style={{ flex: 1 }} />
                            <Button title="Approve" onPress={() => handleApprove(app)} style={{ flex: 1 }} loading={processingId === app.id} />
                        </View>
                    </Card>
                ))}
            </ScrollView>

            <Modal visible={rejectionModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Reject Volunteer</Text>
                        <TextInput style={styles.input} placeholder="Reason..." value={rejectionReason} onChangeText={setRejectionReason} multiline />
                        <View style={styles.modalActions}>
                            <Button title="Cancel" variant="outline" onPress={() => setRejectionModalVisible(false)} style={{ flex: 1 }} />
                            <Button title="Confirm" variant="destructive" onPress={handleReject} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.base, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
    headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
    content: { padding: spacing.base },
    empty: { textAlign: 'center', marginTop: 40, color: colors.mutedForeground },
    card: { padding: spacing.md, marginBottom: spacing.md },
    name: { fontSize: 18, fontWeight: 'bold' },
    subText: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
    docList: { marginVertical: 12 },
    docItem: { flexDirection: 'row', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 4, marginBottom: 8 },
    docName: { marginLeft: 8, color: colors.primary, fontSize: 12 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 8 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    input: { height: 100, backgroundColor: colors.muted, padding: 12, textAlignVertical: 'top', borderRadius: 4, marginBottom: 16 },
    modalActions: { flexDirection: 'row', gap: 12 }
});
