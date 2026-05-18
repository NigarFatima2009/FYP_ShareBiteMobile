const path = require('path');

module.exports = {
  project: {
    android: {},
    ios: {},
  },
  dependencies: {},
  codegenConfig: {
    name: 'ShareBiteSpec',
    type: 'all',
    jsSrcsDir: path.resolve(__dirname, './src'),
    android: {
      javaPackageName: 'com.sharebite',
    },
  },
};
