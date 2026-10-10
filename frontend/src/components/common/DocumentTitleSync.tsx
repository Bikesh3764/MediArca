import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const DocumentTitleSync: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    let title = 'MediArca — Clinical Healthcare Platform';

    if (path === '/') {
      title = 'MediArca — Digital Outpatient Clinical Network';
    } else if (path === '/doctors' || path === '/patient/doctors') {
      title = 'Find Specialists & Clinics — MediArca';
    } else if (path.startsWith('/book/') || path.startsWith('/patient/book/')) {
      title = 'Book Clinical Consultation — MediArca';
    } else if (path.startsWith('/doctor/dashboard')) {
      title = 'Doctor Console & Live Queue — MediArca';
    } else if (path.startsWith('/doctor/consultation')) {
      title = 'Consultation Pad — MediArca';
    } else if (path.startsWith('/doctor/schedule')) {
      title = 'Manage Practice Shifts — MediArca';
    } else if (path.startsWith('/doctor/affiliations')) {
      title = 'Clinic Affiliations — MediArca';
    } else if (path.startsWith('/doctor/profile')) {
      title = 'Doctor Profile & Credentials — MediArca';
    } else if (path.startsWith('/doctor/') || path.startsWith('/patient/doctor/')) {
      title = 'Doctor Profile & Booking — MediArca';
    } else if (path.startsWith('/clinic/dashboard')) {
      title = 'Clinic Administration — MediArca';
    } else if (path.startsWith('/clinic/login') || path.startsWith('/clinic/auth')) {
      title = 'Clinic Partner Portal — MediArca';
    } else if (path.startsWith('/receptionist/dashboard')) {
      title = 'Desk Queue Management — MediArca';
    } else if (path.startsWith('/receptionist/login') || path.startsWith('/receptionist/auth')) {
      title = 'Receptionist Desk Portal — MediArca';
    } else if (path === '/patient/appointments' || path === '/appointments') {
      title = 'Live Queue Passes — MediArca';
    } else if (path === '/patient/profile' || path === '/profile') {
      title = 'Patient Profile & Health Details — MediArca';
    } else if (path === '/clinic-checkin') {
      title = 'Express Clinic Check-in — MediArca';
    } else if (path === '/admin') {
      title = 'Platform Administration — MediArca';
    } else if (path === '/admin-login' || path === '/admin/login') {
      title = 'Admin Access — MediArca';
    } else if (path === '/login' || path === '/patient/login' || path === '/doctor/login') {
      title = 'Sign In — MediArca';
    } else if (path === '/signup' || path === '/patient/signup' || path === '/doctor/signup') {
      title = 'Create Account — MediArca';
    } else if (path === '/about') {
      title = 'About Us — MediArca';
    } else if (path === '/contact') {
      title = 'Contact Us — MediArca';
    } else if (path === '/how-it-works') {
      title = 'How Queue Works — MediArca';
    } else if (path === '/faq') {
      title = 'Frequently Asked Questions — MediArca';
    } else if (path === '/terms') {
      title = 'Terms of Service — MediArca';
    } else if (path === '/privacy') {
      title = 'Privacy Policy — MediArca';
    } else if (path === '/refund-policy') {
      title = 'Refund Policy — MediArca';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
};

export default DocumentTitleSync;
