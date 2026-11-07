// Android app download. The APK lives in the public R2 bucket (mediarca-vault, key app/MediArca.apk);
// a new build overwrites that file, so this link stays the same (steps: docs/mobile-roadmap.md).
// mediarca.in/download redirects here too (see seo-plugin.ts), so shared links keep working.
export const ANDROID_APK_URL = 'https://pub-a590817d9f404eb889f6482b025ea9ad.r2.dev/app/MediArca.apk';
export const APP_DOWNLOAD_PATH = '/download';
/** Short link printed in the QR code (mediarca.in is served by Cloudflare, which has the redirect). */
export const APP_DOWNLOAD_SHORT_URL = 'https://mediarca.in/download';
