/**
 * Ad-Free Architecture & Privacy Audit Test
 * Master Plan Part 3 §4 & User Requirement §6
 * Strictly guarantees Ember contains ZERO advertising infrastructure, SDKs, or placements.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Ad-Free Architecture Audit', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const adPackages = [
    'react-native-google-mobile-ads',
    'expo-ads-admob',
    'react-native-admob',
    'applovin',
    'ironsource',
    'unity-ads',
    'chartboost',
    'mopub',
    'facebook-ads',
    'admob',
  ];

  it('contains zero advertising libraries in package.json dependencies', () => {
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    for (const adPkg of adPackages) {
      expect(allDeps[adPkg]).toBeUndefined();
    }
  });

  it('contains no advertising SDKs or placements in source files', () => {
    const srcDir = path.join(rootDir, 'src');

    function scanDir(dir: string): string[] {
      let files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(scanDir(fullPath));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const sourceFiles = scanDir(srcDir);
    const forbiddenPatterns = [
      /InterstitialAd/i,
      /RewardedAd/i,
      /BannerAd/i,
      /AdMob/i,
      /GoogleMobileAds/i,
      /testAdUnit/i,
    ];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
