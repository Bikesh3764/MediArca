import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True in our own installed build (APK), false in Expo Go and the browser preview.
 * Push notifications and Google sign-in need our own build.
 */
export const inOwnBuild = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
