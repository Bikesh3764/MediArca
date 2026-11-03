// SEO data shared by the app (tab titles, meta tags) and the build (vite.config.ts),
// which turns it into one HTML file per public page, sitemap.xml, robots.txt and _redirects.
// Plain data only: no React or browser code, because vite.config.ts imports this file.

export const SITE_URL = 'https://mediarca.in';
export const SITE_NAME = 'MediArca';
export const SITE_IMAGE = `${SITE_URL}/brand/mediarca-icon.png`;
/** Other ways people type the name. Google uses these to match "medi arca" etc. to this site. */
export const SITE_ALT_NAMES = ['Medi Arca', 'Mediarca', 'MediArca India', 'mediarca.in'];
export const SITE_DESCRIPTION =
  'MediArca is an Indian clinic booking and live queue app. Book a doctor, get a token and wait at home until your turn.';
/**
 * MediArca's own profiles on other sites. Google already ranks these for "mediarca";
 * listing them (JSON-LD sameAs + footer links) tells Google they and mediarca.in are
 * the same company. Add new ones here (e.g. Google Business Profile).
 */
export const SITE_SOCIAL: Array<{ label: string; url: string }> = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/company/mediarca' },
  { label: 'Instagram', url: 'https://www.instagram.com/mediarca.in/' },
  { label: 'YouTube', url: 'https://www.youtube.com/@MediArca' },
  // Google Business Profile (Maps place, added 3 Nov 2026)
  { label: 'Google', url: 'https://maps.google.com/?cid=5852882822855328174' },
];
export const SITE_SAME_AS: string[] = SITE_SOCIAL.map((s) => s.url);
/**
 * IndexNow key (Bing, Yandex, Seznam). The same text sits in public/<key>.txt so those search
 * engines can check that pings for mediarca.in come from us. Ping after a deploy:
 * https://api.indexnow.org/indexnow?url=https://mediarca.in/&key=<key>
 */
export const INDEXNOW_KEY = '6ab8e270f4b9d94dc5359cf21fce1796';

export interface SeoPage {
  path: string;
  /** Built file name, served by Cloudflare Pages at `path` */
  file: string;
  title: string;
  description: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
  /**
   * Page text written into the built HTML (FIX-070), so search engines and link previews read it
   * without running JavaScript. The app replaces it as soon as it starts. Keep it in line with the page.
   */
  heading: string;
  intro: string;
  points?: Array<{ title: string; text: string }>;
}

/** Public pages Google should index. Everything else is private (noindex) or a 404. */
export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    file: 'index.html',
    title: 'MediArca — Book a Doctor, Skip the Wait',
    description:
      'MediArca: book a doctor at a clinic near you in India, get a queue token and track your live place in line from home. ₹0 platform fee, pay the receptionist.',
    changefreq: 'weekly',
    priority: '1.0',
    heading: 'Book your token. Skip the waiting room.',
    intro:
      'MediArca is a clinic booking and live queue app for India. Book a doctor, get a token number and wait at home until your turn is close. ₹0 platform fee: you pay the doctor’s fee to the receptionist.',
    points: [
      { title: 'Book a token', text: 'Pick a doctor and shift. Pay the receptionist by UPI or at the desk.' },
      { title: 'Track it live', text: 'See how many are ahead and leave home on time.' },
      { title: 'Scan and walk in', text: 'Scan the clinic QR when you arrive. Go in on your turn.' },
      { title: 'Browse by specialty', text: 'General Medicine, Pediatrics, Gynecology, Dermatology, Orthopedics, Cardiology, ENT, Ophthalmology and Neurology.' },
    ],
  },
  {
    path: '/doctors',
    file: 'doctors.html',
    title: 'Find a Doctor Near You — MediArca',
    description:
      'Find doctors and clinics near you on MediArca. Check fees in ₹, today’s shifts and whether the doctor is in, then book a token for an in-person clinic visit.',
    changefreq: 'daily',
    priority: '0.9',
    heading: 'Find a doctor near you',
    intro:
      'Search doctors and clinics by name, specialty or city. See fees in ₹, today’s shifts and the doctor’s status, then book a token for an in-person visit.',
    points: [
      { title: 'Verified doctors', text: 'Doctors and clinics are checked by the MediArca team before they are listed.' },
      { title: 'Shifts, not slots', text: 'Doctors work in shifts such as Morning 9 AM – 1 PM. You get a token and an estimated time.' },
    ],
  },
  {
    path: '/how-it-works',
    file: 'how-it-works.html',
    title: 'How It Works — MediArca',
    description:
      'How MediArca works: book a clinic visit online, pay the receptionist, track your token live, scan the clinic QR on arrival and see the doctor without a long wait.',
    changefreq: 'monthly',
    priority: '0.8',
    heading: 'How MediArca works',
    intro:
      'Book online, track your token live, scan the clinic QR code when you arrive and see the doctor without a long wait.',
    points: [
      { title: 'Find a doctor', text: 'Search by name, specialty or clinic. Pick a date and a shift. You get a token and an estimated time.' },
      { title: 'Pay the receptionist', text: 'Call the desk and pay by UPI, or pay at the desk. Your token is confirmed once you pay.' },
      { title: 'Track your turn', text: 'See how many people are ahead of you. Leave home when your turn is close.' },
      { title: 'Scan and walk in', text: 'Scan the clinic QR at the front desk when you arrive. Go in on your turn.' },
      { title: '₹0 platform fee', text: 'You only pay the doctor’s fee to the receptionist.' },
      { title: 'Free cancellation', text: 'Cancel any time before your visit.' },
      { title: 'Book for family', text: 'Book for parents or children in their name.' },
      { title: 'Doctor status', text: 'See if the doctor is in or has stepped out.' },
    ],
  },
  {
    path: '/faq',
    file: 'faq.html',
    title: 'FAQ — MediArca',
    description:
      'MediArca FAQ: how live queue tokens work, paying the receptionist by UPI or at the desk, booking for family, free cancellation and checking in with the clinic QR.',
    changefreq: 'monthly',
    priority: '0.7',
    heading: 'Frequently asked questions',
    intro:
      'Answers about live queue tokens, paying the receptionist, booking for family, cancelling and checking in at the clinic.',
  },
  {
    path: '/about',
    file: 'about.html',
    title: 'About Us — MediArca',
    description:
      'MediArca (mediarca.in) helps Indian clinics run a live outpatient queue, so patients book a token, wait at home and reach the clinic only when their turn is close.',
    changefreq: 'monthly',
    priority: '0.6',
    heading: 'About MediArca',
    intro:
      'MediArca (mediarca.in) helps Indian clinics run a live outpatient queue, so patients wait at home and not in a crowded waiting room.',
    points: [
      { title: 'For patients', text: 'Find verified doctors, book a token and reach the clinic when your turn is close.' },
      { title: 'For clinics and doctors', text: 'Walk-ins and online bookings in one queue. Fewer crowds, smoother OPD.' },
      { title: 'Built for real clinics', text: 'Simple tools that fit how Indian OPDs work: ₹0 platform fee, pay the receptionist, doctor status and QR check-in.' },
    ],
  },
  {
    path: '/contact',
    file: 'contact.html',
    title: 'Contact Us — MediArca',
    description: 'Contact the MediArca team for help with bookings, live queue tokens, clinic listings and doctor accounts. Email contact@mediarca.in or send us a message.',
    changefreq: 'yearly',
    priority: '0.5',
    heading: 'Contact us',
    intro:
      'Need help with a booking, a clinic or a doctor account? Email contact@mediarca.in or send us a message. For a medical emergency, call 112 or 108.',
    points: [
      { title: 'For doctors and clinics', text: 'List your clinic and add your doctors.' },
    ],
  },
  {
    path: '/track',
    file: 'track.html',
    title: 'Track Walk-in — MediArca',
    description: 'Walked in at the clinic? Enter your mobile number and the code on your slip to see your token, the token being served now and your estimated time on MediArca.',
    changefreq: 'yearly',
    priority: '0.5',
    heading: 'Track your walk-in',
    intro:
      'Walked in at the clinic? Enter your mobile number and the code on your slip to see your token, the token being served and your estimated time.',
  },
  {
    path: '/terms',
    file: 'terms.html',
    title: 'Terms of Service — MediArca',
    description: 'Terms of Service for MediArca: the rules for booking in-person clinic visits, using live queue tokens and managing outpatient queues as a doctor or clinic.',
    changefreq: 'yearly',
    priority: '0.3',
    heading: 'Terms of Service',
    intro:
      'The terms for using MediArca to book in-person clinic visits and manage outpatient queues.',
  },
  {
    path: '/privacy',
    file: 'privacy.html',
    title: 'Privacy Policy — MediArca',
    description: 'MediArca Privacy Policy: what personal information we collect when you book a clinic visit, how we use and protect it, and the choices you have about your data.',
    changefreq: 'yearly',
    priority: '0.3',
    heading: 'Privacy Policy',
    intro:
      'How MediArca collects, uses and protects your personal information.',
  },
  {
    path: '/refund-policy',
    file: 'refund-policy.html',
    title: 'Cancellation Policy — MediArca',
    description: 'MediArca Cancellation Policy: cancel any booking before your visit with no fee. We take no payment online; the doctor’s fee is paid to the clinic receptionist.',
    changefreq: 'yearly',
    priority: '0.3',
    heading: 'Cancellation Policy',
    intro:
      'Cancel any time before your visit with no fee. MediArca takes no payment online: fees are paid to the receptionist.',
  },
];

/** Old aliases kept as permanent (301) redirects. */
export const SEO_REDIRECTS: Array<[from: string, to: string]> = [
  ['/refunds', '/refund-policy'],
  ['/cancellation-policy', '/refund-policy'],
  ['/patient/doctors', '/doctors'],
  ['/patient/doctor/:id', '/doctor/:id'],
  ['/receptionist/signup', '/receptionist/login'],
  ['/admin-login', '/admin/login'],
];

/**
 * App screens that are not in SEO_PAGES. They load the app (status 200) but are
 * marked noindex and blocked in robots.txt where private. Any path not listed here
 * or in SEO_PAGES gets a real 404, which is what removes the old website's pages from Google.
 */
export const APP_ROUTES: string[] = [
  '/login',
  '/signup',
  '/forgot-password',
  '/clinic-checkin',
  '/clinics/:id',
  '/patient/login',
  '/patient/signup',
  '/patient/appointments',
  '/patient/profile',
  '/patient/records',
  '/patient/vault',
  '/patient/book/:id',
  '/appointments',
  '/profile',
  '/records',
  '/vault',
  '/book/:id',
  '/doctor/login',
  '/doctor/signup',
  '/doctor/dashboard',
  '/doctor/schedule',
  '/doctor/profile',
  '/doctor/consultation/:id',
  '/doctor/:id',
  '/clinic/login',
  '/clinic/signup',
  '/clinic/dashboard',
  '/clinic/profile',
  '/receptionist/login',
  '/receptionist/dashboard',
  '/admin/login',
  '/admin',
];

/** Kept out of search results (robots.txt). Public doctor pages (/doctor/:id) stay crawlable. */
export const ROBOTS_DISALLOW: string[] = [
  '/login',
  '/signup',
  '/forgot-password',
  '/clinic-checkin',
  '/patient/',
  '/appointments',
  '/profile',
  '/records',
  '/vault',
  '/book/',
  '/doctor/login',
  '/doctor/signup',
  '/doctor/dashboard',
  '/doctor/schedule',
  '/doctor/profile',
  '/doctor/consultation/',
  '/clinic/',
  '/receptionist/',
  '/admin',
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: 'How does the live queue work?',
    answer:
      'When you book, you get a token number. Your appointment page shows how many people are ahead of you and when to reach the clinic.',
  },
  {
    question: 'Do I pay anything online?',
    answer:
      'No. MediArca has a ₹0 platform fee. You pay the doctor’s fee to the receptionist, by UPI over a call or at the desk. Your token is confirmed once you pay.',
  },
  {
    question: 'Can I book for my family?',
    answer:
      'Yes. On the booking page, choose "Someone else" and enter their name and age. The token is made in their name.',
  },
  {
    question: 'Can I cancel?',
    answer: 'Yes, any time before your visit, from Appointments. There is no cancellation fee.',
  },
  {
    question: 'What if the doctor is late?',
    answer:
      'The clinic updates the doctor’s status (In Cabin, Stepped Out or Not in Cabin). You see it on your appointment right away.',
  },
  {
    question: 'How do I check in at the clinic?',
    answer:
      'Scan the QR code at the front desk with your phone. You can also tell the receptionist your token number.',
  },
];
