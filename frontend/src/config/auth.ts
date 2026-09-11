export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '868507235434-76q4g3c560hklhploh8p3dihp9q0ugs0.apps.googleusercontent.com';

export const isGoogleConfigured = Boolean(
  GOOGLE_CLIENT_ID &&
  !GOOGLE_CLIENT_ID.includes('1234567890') &&
  !GOOGLE_CLIENT_ID.includes('your-google-client-id')
);
