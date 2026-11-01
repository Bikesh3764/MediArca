// Google sign-in (native Google account picker). Only in our own build, not in Expo Go or the browser.
// The server checks the Google ID token against the website's Google client, same as the website.
import { inOwnBuild } from './nativeBuild';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

// Public web client ID (same as the website's VITE_GOOGLE_CLIENT_ID)
const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '868507235434-76q4g3c560hklhploh8p3dihp9q0ugs0.apps.googleusercontent.com';

export const googleAvailable = inOwnBuild;

let mod: GoogleModule | null = null;
const google = (): GoogleModule => {
  if (!mod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  }
  return mod;
};

/** Opens the Google account picker. Returns the ID token, or null if the person backed out. */
export const getGoogleIdToken = async (): Promise<string | null> => {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the picker so a different Google account can be chosen
    await GoogleSignin.signOut().catch(() => {});
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error('Google didn’t return a sign-in. Try again.');
    return res.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services is needed for Google sign-in.');
      throw new Error('Couldn’t sign in with Google. Try again.');
    }
    throw err;
  }
};
