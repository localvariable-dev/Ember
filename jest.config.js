module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/__tests__', '<rootDir>/tools'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'mjs', 'node'],
  transform: {
    '^.+\\.[jmt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(ogg|wav|mp3|flac|m4a)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/__mocks__/'],
};
