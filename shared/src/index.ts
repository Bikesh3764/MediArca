// Code used by both the website (frontend/) and the mobile app (mobile/).
// Nothing here may use the browser (window, document, localStorage) or React Native directly:
// anything platform-specific comes through configurePlatform() in ./platform.
export * from './platform';
export * from './api';
export * from './safeFetch';
export * from './utils/phoneUtils';
export * from './utils/address';
export * from './utils/indiaStates';
export * from './utils/checkinQr';
