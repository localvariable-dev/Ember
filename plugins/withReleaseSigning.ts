import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

const withReleaseSigning: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('EMBER_RELEASE_STORE_FILE')) {
      config.modResults.contents += `
android {
    signingConfigs {
        release {
            if (project.hasProperty('EMBER_RELEASE_STORE_FILE') && file(EMBER_RELEASE_STORE_FILE).exists()) {
                storeFile file(EMBER_RELEASE_STORE_FILE)
                storePassword EMBER_RELEASE_STORE_PASSWORD
                keyAlias EMBER_RELEASE_KEY_ALIAS
                keyPassword EMBER_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            if (project.hasProperty('EMBER_RELEASE_STORE_FILE') && file(EMBER_RELEASE_STORE_FILE).exists()) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
`;
    }
    return config;
  });
};

export default withReleaseSigning;
