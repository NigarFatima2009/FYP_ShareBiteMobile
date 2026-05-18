/**
 * Responsive utilities for ShareBite
 * Handles different screen sizes for better UI on all devices
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro / standard design)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Get responsive width
export const wp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH * percentage) / 100);
};

// Get responsive height
export const hp = (percentage: number): number => {
  return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * percentage) / 100);
};

// Scale based on screen width
export const scale = (size: number): number => {
  const scaleFactor = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Scale font size with limits
export const scaleFont = (size: number): number => {
  const scaleFactor = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scaleFactor;
  // Limit scaling to prevent too large/small fonts
  const minScale = 0.85;
  const maxScale = 1.2;
  const clampedScale = Math.min(Math.max(scaleFactor, minScale), maxScale);
  return Math.round(PixelRatio.roundToNearestPixel(size * clampedScale));
};

// Moderate scale (less aggressive scaling)
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const scaleFactor = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size + (size * (scaleFactor - 1) * factor));
};

// Check if device is small screen
export const isSmallDevice = (): boolean => {
  return SCREEN_WIDTH < 375;
};

// Check if device is large screen
export const isLargeDevice = (): boolean => {
  return SCREEN_WIDTH >= 414;
};

// Check if device is tablet
export const isTablet = (): boolean => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  return SCREEN_WIDTH >= 600 || aspectRatio < 1.6;
};

// Get screen dimensions
export const screenDimensions = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

// Responsive spacing
export const responsiveSpacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  base: moderateScale(16),
  lg: moderateScale(20),
  xl: moderateScale(24),
  '2xl': moderateScale(32),
  '3xl': moderateScale(40),
};

// Responsive font sizes
export const responsiveFontSize = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  '2xl': scaleFont(24),
  '3xl': scaleFont(30),
};

export default {
  wp,
  hp,
  scale,
  scaleFont,
  moderateScale,
  isSmallDevice,
  isLargeDevice,
  isTablet,
  screenDimensions,
  responsiveSpacing,
  responsiveFontSize,
};
