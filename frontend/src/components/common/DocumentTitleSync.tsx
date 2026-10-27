import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_PAGES, SITE_URL } from '../../seo/site';

const DOCTOR_PRIVATE = ['login', 'signup', 'dashboard', 'schedule', 'profile', 'consultation', 'affiliations'];

/** Public doctor page: /doctor/<id>, not one of the doctor's own screens. */
const isDoctorPage = (path: string) => {
  const match = /^\/doctor\/([^/]+)\/?$/.exec(path);
  return Boolean(match && !DOCTOR_PRIVATE.includes(match[1]));
};

const setHeadTag = (selector: string, create: () => HTMLElement, attr: string, value: string | null) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const metaByName = (name: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  return el;
};

const metaByProperty = (property: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute('property', property);
  return el;
};

/** Keeps description, canonical and robots tags right after in-app navigation. */
const syncSearchTags = (path: string) => {
  const page = SEO_PAGES.find((p) => p.path === path);
  const publicPage = Boolean(page) || isDoctorPage(path);
  const canonical = publicPage ? `${SITE_URL}${path}` : null;
  setHeadTag('link[rel="canonical"]', () => {
    const el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    return el;
  }, 'href', canonical);
  setHeadTag('meta[property="og:url"]', metaByProperty('og:url'), 'content', canonical);
  if (page) {
    setHeadTag('meta[name="description"]', metaByName('description'), 'content', page.description);
    setHeadTag('meta[property="og:description"]', metaByProperty('og:description'), 'content', page.description);
    setHeadTag('meta[property="og:title"]', metaByProperty('og:title'), 'content', page.title);
  }
  // Sign-in screens, dashboards and unknown pages stay out of Google.
  setHeadTag('meta[name="robots"]', metaByName('robots'), 'content', publicPage ? null : 'noindex');
};

export const DocumentTitleSync: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    let title = 'MediArca';
    const seoPage = SEO_PAGES.find((p) => p.path === path);

    if (seoPage) {
      title = seoPage.title;
    } else if (path === '/') {
      title = 'MediArca — Book a Doctor, Skip the Wait';
    } else if (path === '/doctors' || path === '/patient/doctors') {
      title = 'Doctors — MediArca';
    } else if (path.startsWith('/book/') || path.startsWith('/patient/book/')) {
      title = 'Book Appointment — MediArca';
    } else if (path.startsWith('/doctor/dashboard')) {
      title = 'Queue — MediArca';
    } else if (path.startsWith('/doctor/schedule')) {
      title = 'Schedule — MediArca';
    } else if (path.startsWith('/doctor/affiliations')) {
      title = 'Clinics — MediArca';
    } else if (path.startsWith('/doctor/profile')) {
      title = 'Profile — MediArca';
    } else if (path === '/doctor/login') {
      title = 'Sign In — MediArca';
    } else if (path === '/doctor/signup') {
      title = 'Create Account — MediArca';
    } else if (path.startsWith('/doctor/') || path.startsWith('/patient/doctor/')) {
      title = 'Doctor — MediArca';
    } else if (path.startsWith('/clinic/dashboard')) {
      title = 'Clinic — MediArca';
    } else if (path.startsWith('/clinic/login') || path.startsWith('/clinic/auth')) {
      title = 'Clinic Sign In — MediArca';
    } else if (path.startsWith('/receptionist/dashboard')) {
      title = 'Front Desk — MediArca';
    } else if (path.startsWith('/receptionist/login') || path.startsWith('/receptionist/auth')) {
      title = 'Receptionist Sign In — MediArca';
    } else if (path === '/patient/appointments' || path === '/appointments') {
      title = 'Live Queue Passes — MediArca';
    } else if (path === '/patient/profile' || path === '/profile') {
      title = 'Profile — MediArca';
    } else if (path === '/clinic-checkin') {
      title = 'Check In — MediArca';
    } else if (path === '/track') {
      title = 'Track Walk-in — MediArca';
    } else if (path === '/admin') {
      title = 'Admin — MediArca';
    } else if (path === '/admin-login' || path === '/admin/login') {
      title = 'Admin Sign In — MediArca';
    } else if (path === '/login' || path === '/patient/login' || path === '/doctor/login') {
      title = 'Sign In — MediArca';
    } else if (path === '/signup' || path === '/patient/signup' || path === '/doctor/signup') {
      title = 'Create Account — MediArca';
    } else if (path === '/about') {
      title = 'About Us — MediArca';
    } else if (path === '/contact') {
      title = 'Contact Us — MediArca';
    } else if (path === '/how-it-works') {
      title = 'How It Works — MediArca';
    } else if (path === '/faq') {
      title = 'FAQ — MediArca';
    } else if (path === '/terms') {
      title = 'Terms of Service — MediArca';
    } else if (path === '/privacy') {
      title = 'Privacy Policy — MediArca';
    } else if (path === '/refund-policy' || path === '/refunds' || path === '/cancellation-policy') {
      title = 'Cancellation Policy — MediArca';
    } else if (path === '/clinic/signup') {
      title = 'Register Clinic — MediArca';
    } else if (path === '/receptionist/signup') {
      title = 'Join a Front Desk — MediArca';
    } else if (path.startsWith('/clinic/profile')) {
      title = 'Clinic Settings — MediArca';
    } else if (path === '/forgot-password') {
      title = 'Reset Password — MediArca';
    } else if (!['/records', '/patient/records', '/vault', '/patient/vault'].includes(path)) {
      title = 'Page Not Found — MediArca';
    }

    document.title = title;
    syncSearchTags(path);
  }, [location.pathname]);

  return null;
};

export default DocumentTitleSync;
