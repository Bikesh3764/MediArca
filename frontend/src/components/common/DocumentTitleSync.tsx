import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const DocumentTitleSync: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    let title = 'MediArca';

    if (path === '/') {
      title = 'MediArca — Book a Doctor, Skip the Wait';
    } else if (path === '/doctors' || path === '/patient/doctors') {
      title = 'Find Doctors — MediArca';
    } else if (path.startsWith('/book/') || path.startsWith('/patient/book/')) {
      title = 'Book Appointment — MediArca';
    } else if (path.startsWith('/doctor/dashboard')) {
      title = 'Queue — MediArca';
    } else if (path.startsWith('/doctor/consultation')) {
      title = 'Consultation — MediArca';
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
    } else if (path === '/refund-policy') {
      title = 'Cancellation Policy — MediArca';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
};

export default DocumentTitleSync;
