import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import { Card } from '../components/common/Card';
import { colors, typography, spacing, borderRadius } from '../theme';

interface DonationDetailProps {
  navigation: any;
  route: any;
}

export const DonationDetail: React.FC<DonationDetailProps> = ({
  navigation,
  route,
}) => {
  const { donationId, isOwner = false } = route.params || {};
  const [donation, setDonation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    loadDonation();
  }, [donationId]);

  const loadDonation = async () => {
    try {
      setLoading(true);
      const doc = await firestore().collection('donations').doc(donationId).get();
      const docExists = (doc as any).exists;

      if (docExists) {
        const data = { id: doc.id, ...doc.data() };
        setDonation(data);
        setEditData(data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Not Found',
          text2: 'Donation not found',
        });
        navigation.goBack();
      }
      setLoading(false);
    } catch (error) {
      console.log('Load donation error:', error);
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load donation details',
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await firestore().collection('donations').doc(donationId).update({
        title: editData.title,
        description: editData.description,
        quantity: editData.quantity,
        pickupAddress: editData.pickupAddress,
        specialInstructions: editData.specialInstructions,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      setDonation(editData);
      setEditing(false);
      setSaving(false);

      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: 'Donation details updated successfully',
      });
    } catch (error) {
      console.log('Save error:', error);
      setSaving(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save changes',
      });
    }
  };

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
      if (dateValue?.toDate) {
        return dateValue.toDate().toLocaleDateString();
      }
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return colors.primary;
      case 'approved': return '#3B82F6';
      case 'claimed': return '#F59E0B';
      case 'in_transit': return '#8B5CF6';
      case 'delivered': return colors.primary;
      default: return colors.mutedForeground;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Donation Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!donation) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Donation Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="alert-circle-outline" size={64} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>Donation not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donation Details</Text>
        {isOwner && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editButton}>
            <Icon name="create-outline" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity onPress={() => setEditing(false)} style={styles.editButton}>
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Image */}
        {donation.images && donation.images.length > 0 && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: donation.images[0] }} style={styles.image} />
          </View>
        )}

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(donation.status) }]}>
            <Text style={styles.statusText}>{donation.status?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Title & Description */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Food Information</Text>

          {editing ? (
            <>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={editData.title}
                onChangeText={(text) => setEditData({ ...editData, title: text })}
                placeholder="Food title"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editData.description}
                onChangeText={(text) => setEditData({ ...editData, description: text })}
                placeholder="Description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Quantity/Servings</Text>
              <TextInput
                style={styles.input}
                value={editData.quantity?.toString()}
                onChangeText={(text) => setEditData({ ...editData, quantity: text })}
                placeholder="Quantity"
              />
            </>
          ) : (
            <>
              <Text style={styles.foodTitle}>{donation.title}</Text>
              <Text style={styles.description}>{donation.description || 'No description'}</Text>

              <View style={styles.infoRow}>
                <Icon name="cube-outline" size={18} color={colors.mutedForeground} />
                <Text style={styles.infoText}>Quantity: {donation.quantity || donation.servings}</Text>
              </View>

              <View style={styles.infoRow}>
                <Icon name="restaurant-outline" size={18} color={colors.mutedForeground} />
                <Text style={styles.infoText}>Type: {donation.foodType || 'Not specified'}</Text>
              </View>
            </>
          )}
        </Card>

        {/* Dates */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Dates</Text>

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Icon name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.dateLabel}>Posted</Text>
              <Text style={styles.dateValue}>{formatDate(donation.createdAt)}</Text>
            </View>

            <View style={styles.dateItem}>
              <Icon name="time-outline" size={20} color="#F59E0B" />
              <Text style={styles.dateLabel}>Expires</Text>
              <Text style={styles.dateValue}>{formatDate(donation.bestBefore)}</Text>
            </View>
          </View>
        </Card>

        {/* Location */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>

          {editing ? (
            <>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editData.pickupAddress}
                onChangeText={(text) => setEditData({ ...editData, pickupAddress: text })}
                placeholder="Pickup address"
                multiline
                numberOfLines={2}
              />
            </>
          ) : (
            <View style={styles.infoRow}>
              <Icon name="location-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.infoText}>{donation.pickupAddress || 'Not specified'}</Text>
            </View>
          )}
        </Card>

        {/* Dietary Information */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Dietary Information</Text>

          <View style={styles.tagsContainer}>
            {donation.dietaryType && (
              <View style={[styles.tag, {
                backgroundColor: donation.dietaryType === 'vegetarian' ? colors.primary :
                  donation.dietaryType === 'sweets-bakery' ? '#F59E0B' : '#EF4444'
              }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon
                    name={donation.dietaryType === 'vegetarian' ? 'leaf-outline' :
                      donation.dietaryType === 'sweets-bakery' ? 'ice-cream-outline' : 'nutrition-outline'}
                    size={14}
                    color="#fff"
                  />
                  <Text style={[styles.tagText, { marginLeft: 4 }]}>
                    {donation.dietaryType === 'vegetarian' ? 'Vegetarian' :
                      donation.dietaryType === 'sweets-bakery' ? 'Sweets/Bakery' : 'Non-Veg'}
                  </Text>
                </View>
              </View>
            )}
            {donation.isHalal && (
              <View style={[styles.tag, { backgroundColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="checkmark-circle-outline" size={14} color="#fff" />
                  <Text style={[styles.tagText, { marginLeft: 4 }]}>Halal</Text>
                </View>
              </View>
            )}
            {donation.isHomemade && (
              <View style={[styles.tag, { backgroundColor: '#F59E0B' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="home-outline" size={14} color="#fff" />
                  <Text style={[styles.tagText, { marginLeft: 4 }]}>Homemade</Text>
                </View>
              </View>
            )}
            {donation.isOrganic && (
              <View style={[styles.tag, { backgroundColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="leaf-outline" size={14} color="#fff" />
                  <Text style={[styles.tagText, { marginLeft: 4 }]}>Organic</Text>
                </View>
              </View>
            )}
            {donation.isGlutenFree && (
              <View style={[styles.tag, { backgroundColor: '#8B5CF6' }]}>
                <Text style={styles.tagText}>Gluten-Free</Text>
              </View>
            )}
          </View>

          {donation.allergens && donation.allergens.length > 0 && (
            <View style={styles.allergensSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="warning-outline" size={18} color="#EF4444" />
                <Text style={[styles.allergensTitle, { marginLeft: 6 }]}>Contains Allergens:</Text>
              </View>
              <Text style={styles.allergensText}>{donation.allergens.join(', ')}</Text>
            </View>
          )}

          {donation.spiceLevel && donation.dietaryType !== 'sweets-bakery' && (
            <View style={styles.infoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.infoText}>Spice Level: </Text>
                <Icon
                  name={donation.spiceLevel === 'mild' ? 'happy-outline' : 'flame-outline'}
                  size={16}
                  color="#666"
                />
                <Text style={[styles.infoText, { marginLeft: 4 }]}>
                  {donation.spiceLevel === 'mild' ? 'Mild' : donation.spiceLevel === 'medium' ? 'Medium' : 'Spicy'}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Special Instructions */}
        {(donation.specialInstructions || editing) && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>

            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editData.specialInstructions}
                onChangeText={(text) => setEditData({ ...editData, specialInstructions: text })}
                placeholder="Any special instructions for pickup"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.description}>{donation.specialInstructions}</Text>
            )}
          </Card>
        )}

        {/* Donor Info (for NGO view) */}
        {!isOwner && donation.donorName && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Donor Information</Text>

            <View style={styles.donorRow}>
              <View style={styles.donorAvatar}>
                <Icon name="person" size={24} color={colors.white} />
              </View>
              <View style={styles.donorInfo}>
                <Text style={styles.donorName}>{donation.donorName}</Text>
                {donation.donorPhone && (
                  <Text style={styles.donorPhone}>{donation.donorPhone}</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Save Button */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Icon name="checkmark" size={20} color={colors.white} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Request Button (for NGO) */}
        {!isOwner && donation.status === 'available' && (
          <TouchableOpacity
            style={styles.requestButton}
            onPress={() => {
              // Navigate back and trigger request
              navigation.goBack();
            }}
          >
            <Icon name="hand-left" size={20} color={colors.white} />
            <Text style={styles.requestButtonText}>Request This Donation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#EC4899',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  editButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  imageContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  foodTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dateItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  dateValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  allergensSection: {
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  allergensTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: '#92400E',
    marginBottom: spacing.xs,
  },
  allergensText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#92400E',
  },
  donorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  donorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  donorPhone: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  requestButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
});

export default DonationDetail;
