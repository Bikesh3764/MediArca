// SEO data shared by the app (tab titles, meta tags) and the build (vite.config.ts),
// which turns it into one HTML file per public page, sitemap.xml, robots.txt and _redirects.
// Plain data only: no React or browser code, because vite.config.ts imports this file.

export const SITE_URL = 'https://mediarca.in';
export const SITE_NAME = 'MediArca';
export const SITE_IMAGE = `${SITE_URL}/brand/mediarca-icon.png`;

export interface SeoPage {
  path: string;
  /** Built file name, served by Cloudflare Pages at `path` */
  file: string;
  title: string;
  description: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
}

/** Public pages Google should index. Everything else is private (noindex) or a 404. */
export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    file: 'index.html',
    title: 'MediArca — Book a Doctor, Skip the Wait',
    description:
      'Book a clinic visit in India, get a queue token and see your live place in line. ₹0 platform fee, pay the receptionist.',
    changefreq: 'weekly',
    priority: '1.0',
  },
  {
    path: '/doctors',
    file: 'doctors.html',
    title: 'Find a Doctor Near You — MediArca',
    description:
      'Find doctors and clinics, check fees in ₹ and today’s timings, and book a token for an in-person visit.',
    changefreq: 'daily',
    priority: '0.9',
  },
  {
    path: '/how-it-works',
    file: 'how-it-works.html',
    title: 'How It Works — MediArca',
    description:
      'Book online, track your token live, scan the clinic QR code on arrival and see the doctor without a long wait.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/faq',
    file: 'faq.html',
    title: 'FAQ — MediArca',
    description:
      'Answers about live queue tokens, paying the receptionist, booking for family, cancelling and checking in.',
    changefreq: 'monthly',
    priority: '0.7',
  },
  {
    path: '/about',
    file: 'about.html',
    title: 'About Us — MediArca',
    description:
      'MediArca helps Indian clinics run a live outpatient queue so patients wait at home, not in the waiting room.',
    changefreq: 'monthly',
    priority: '0.6',
  },
  {
    path: '/contact',
    file: 'contact.html',
    title: 'Contact Us — MediArca',
    description: 'Contact the MediArca team for help with bookings, clinics and doctor accounts.',
    changefreq: 'yearly',
    priority: '0.5',
  },
  {
    path: '/track',
    file: 'track.html',
    title: 'Track Walk-in — MediArca',
    description: 'Walked in at the clinic? Enter your mobile number and slip code to see your live place in line.',
    changefreq: 'yearly',
    priority: '0.5',
  },
  {
    path: '/terms',
    file: 'terms.html',
    title: 'Terms of Service — MediArca',
    description: 'Terms for using MediArca to book clinic visits and manage outpatient queues.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/privacy',
    file: 'privacy.html',
    title: 'Privacy Policy — MediArca',
    description: 'How MediArca collects, uses and protects your personal information.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/refund-policy',
    file: 'refund-policy.html',
    title: 'Cancellation Policy — MediArca',
    description: 'Cancel any time before your visit with no fee. Fees are paid at the clinic, not online.',
    changefreq: 'yearly',
    priority: '0.3',
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
      'No. There is no booking fee. You pay the doctor’s fee to the receptionist, by UPI over a call or at the desk. Your token is confirmed once you pay.',
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
