import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme';

interface MaintenanceScreenProps {
  message?: string;
  estimatedTime?: string;
  onRetry?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  message = 'The server is being maintained',
  estimatedTime = 'a few hours',
  onRetry,
}) => {
  return (
    <View style={styles.container}>
      <Icon name="construct" size={80} color={colors.primary} />
      
      <Text style={styles.title}>Under Maintenance</Text>
      
      <Text style={styles.message}>{message}</Text>

      <View style={styles.infoBox}>
        <Icon name="time-outline" size={24} color={colors.primary} />
        <Text style={styles.infoText}>
          Estimated time: {estimatedTime}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Icon name="checkmark-circle-outline" size={24} color={colors.success} />
        <Text style={styles.infoText}>
          We'll be back soon with improvements!
        </Text>
      </View>

      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Icon name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Check Again</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footer}>
        Thank you for your patience
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    width: '90%',
    gap: 15,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 30,
    textAlign: 'center',
  },
});
