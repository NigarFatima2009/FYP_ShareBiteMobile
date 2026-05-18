import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { feedback } from '../services/firestore';

interface FeedbackProps {
  navigation: any;
  user: any;
  addNotification: (notification: any) => void;
}

type FeedbackCategory = 'general' | 'bug' | 'feature' | 'appreciation';

export const Feedback: React.FC<FeedbackProps> = ({
  navigation,
  user,
  addNotification,
}) => {
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('general');
  const [rating, setRating] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includeContact, setIncludeContact] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const feedbackCategories = [
    { value: 'general' as FeedbackCategory, label: 'General Feedback', icon: 'chatbubble', color: '#3B82F6' },
    { value: 'bug' as FeedbackCategory, label: 'Report Bug', icon: 'bug', color: '#EF4444' },
    { value: 'feature' as FeedbackCategory, label: 'Feature Request', icon: 'bulb', color: '#F59E0B' },
    { value: 'appreciation' as FeedbackCategory, label: 'Appreciation', icon: 'heart', color: '#EC4899' },
  ];

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Subject Required',
        text2: 'Please enter a subject',
      });
      return;
    }

    if (!message.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Message Required',
        text2: 'Please enter your feedback message',
      });
      return;
    }

    if ((feedbackCategory === 'general' || feedbackCategory === 'appreciation') && rating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Rating Required',
        text2: 'Please select a rating',
      });
      return;
    }

    try {
      const result = await feedback.create({
        category: feedbackCategory,
        rating,
        subject,
        message,
        includeContact,
        anonymous,
        userId: user?.uid,
        userEmail: user?.email
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      Toast.show({
        type: 'success',
        text1: 'Thank You!',
        text2: 'Your feedback has been submitted',
      });

      addNotification({
        type: 'feedback_submitted',
        title: 'Feedback Submitted',
        message: 'Thank you for helping us improve ShareBite',
      });

      // Reset form
      setFeedbackCategory('general');
      setRating(0);
      setSubject('');
      setMessage('');
      setIncludeContact(false);
      setAnonymous(false);

      navigation.navigate('Dashboard');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit feedback',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRatingMessage = () => {
    switch (rating) {
      case 1:
        return "We're sorry to hear that. Please tell us how we can improve.";
      case 2:
        return "Thanks for your feedback. We'd love to know how to do better.";
      case 3:
        return "Thank you! Please share what we could improve.";
      case 4:
        return "Great! We'd love to hear what made your experience good.";
      case 5:
        return "Wonderful! Tell us what you loved most.";
      default:
        return '';
    }
  };

  const getPlaceholder = () => {
    switch (feedbackCategory) {
      case 'bug':
        return 'Briefly describe the issue';
      case 'feature':
        return 'What feature would you like to see?';
      case 'appreciation':
        return 'What did you appreciate?';
      default:
        return 'What would you like to tell us?';
    }
  };

  const getMessagePlaceholder = () => {
    switch (feedbackCategory) {
      case 'bug':
        return 'Please describe the bug in detail, including steps to reproduce it...';
      case 'feature':
        return 'Describe the feature and how it would help you...';
      case 'appreciation':
        return 'Share your positive experience with us!';
      default:
        return 'Share your thoughts, suggestions, or concerns...';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Feedback</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Community Impact Note */}
        <Card style={[styles.card, styles.impactCard]}>
          <View style={styles.impactContent}>
            <Icon name="heart" size={32} color="#EA580C" />
            <View style={styles.impactText}>
              <Text style={styles.impactTitle}>Help Us Improve</Text>
              <Text style={styles.impactSubtitle}>
                Your feedback helps us build a better food sharing community for everyone.
              </Text>
            </View>
          </View>
        </Card>

        {/* Feedback Category */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>What would you like to share?</Text>
          <Text style={styles.sectionSubtitle}>Select the type of feedback you'd like to provide</Text>

          <View style={styles.categoriesContainer}>
            {feedbackCategories.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.categoryItem,
                  feedbackCategory === category.value && styles.categoryItemActive
                ]}
                onPress={() => setFeedbackCategory(category.value)}
              >
                <View style={styles.categoryRadio}>
                  {feedbackCategory === category.value && (
                    <View style={styles.categoryRadioInner} />
                  )}
                </View>
                <Icon name={category.icon} size={20} color={category.color} />
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Rating (for general feedback and appreciation) */}
        {(feedbackCategory === 'general' || feedbackCategory === 'appreciation') && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>How would you rate your experience?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? '#FFD700' : colors.mutedForeground}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingMessage}>{getRatingMessage()}</Text>
            )}
          </Card>
        )}

        {/* Subject */}
        <Card style={styles.card}>
          <Input
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder={getPlaceholder()}
            editable={!isLoading}
          />
        </Card>

        {/* Detailed Message */}
        <Card style={styles.card}>
          <Input
            label="Details"
            value={message}
            onChangeText={setMessage}
            placeholder={getMessagePlaceholder()}
            multiline
            numberOfLines={6}
            editable={!isLoading}
          />
          <Text style={styles.helperText}>
            {feedbackCategory === 'bug' && 'Please describe the bug in detail, including steps to reproduce it.'}
            {feedbackCategory === 'feature' && 'Describe the feature and how it would help you.'}
            {feedbackCategory === 'appreciation' && 'Share your positive experience with us!'}
            {feedbackCategory === 'general' && 'Share your thoughts, suggestions, or concerns.'}
          </Text>
        </Card>

        {/* Privacy Options */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <TouchableOpacity
            style={styles.checkboxItem}
            onPress={() => setIncludeContact(!includeContact)}
          >
            <View style={styles.checkbox}>
              {includeContact && (
                <Icon name="checkmark" size={16} color={colors.primary} />
              )}
            </View>
            <Text style={styles.checkboxLabel}>
              Include my contact information (so we can follow up if needed)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxItem}
            onPress={() => setAnonymous(!anonymous)}
          >
            <View style={styles.checkbox}>
              {anonymous && (
                <Icon name="checkmark" size={16} color={colors.primary} />
              )}
            </View>
            <Text style={styles.checkboxLabel}>
              Submit anonymously
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Submit Button */}
        <View style={styles.submitButton}>
          <Button
            title={isLoading ? 'Sending...' : 'Send Feedback'}
            onPress={handleSubmit}
            disabled={isLoading}
            loading={isLoading}
            fullWidth
          />
        </View>

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Need Immediate Help?</Text>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => Toast.show({ type: 'info', text1: 'Live chat coming soon' })}
          >
            <Icon name="chatbubbles" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Live Chat Support</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => Toast.show({ type: 'info', text1: 'FAQ coming soon' })}
          >
            <Icon name="help-circle" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Browse FAQ</Text>
            <Icon name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Card>
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
    padding: spacing.base,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
  },
  card: {
    marginBottom: spacing.base,
  },
  impactCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  impactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  impactTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#9A3412',
    marginBottom: spacing.xs,
  },
  impactSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#C2410C',
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  categoriesContainer: {
    gap: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  categoryItemActive: {
    backgroundColor: colors.muted,
    borderColor: colors.primary,
  },
  categoryRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginLeft: spacing.sm,
    flex: 1,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  starButton: {
    padding: spacing.xs,
  },
  ratingMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    flex: 1,
  },
  submitButton: {
    marginBottom: spacing.base,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginLeft: spacing.md,
    flex: 1,
  },
});
