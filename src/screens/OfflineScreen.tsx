import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme';

interface OfflineScreenProps {
  onRetry?: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ onRetry }) => {
  return (
    <View style={styles.container}>
      <Icon name="cloud-offline-outline" size={100} color={colors.textSecondary} />
      
      <Text style={styles.title}>No Internet Connection</Text>
      
      <Text style={styles.message}>
        Please check your internet connection and try again.
      </Text>

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Quick fixes:</Text>
        <Text style={styles.tip}>• Check if WiFi or mobile data is enabled</Text>
        <Text style={styles.tip}>• Try turning airplane mode on and off</Text>
        <Text style={styles.tip}>• Restart your device</Text>
      </View>

      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Icon name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      )}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  tipsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    width: '90%',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  tip: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
