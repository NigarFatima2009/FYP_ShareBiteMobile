const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metrs://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
    blockList: [
      // Ignore Android build directories
      /.*\/android\/app\/build\/.*/,
      /.*\/android\/build\/.*/,
      /.*\/android\/.gradle\/.*/,
      /.*\/node_modules\/.*\/android\/build\/.*/,
      // Ignore iOS build directories
      /.*\/ios\/build\/.*/,
      /.*\/ios\/Pods\/.*/,
    ],
  },
  watchFolders: [path.resolve(__dirname)],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
