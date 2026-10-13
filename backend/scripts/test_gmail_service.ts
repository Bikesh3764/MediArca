import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testGmailService() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('Missing SMTP_USER or SMTP_PASS environment variables.');
    process.exit(1);
  }
  console.log('Testing service: "gmail"...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass
    }
  });

  try {
    await transporter.verify();
    console.log('GMAIL SERVICE VERIFIED SUCCESS!');
  } catch (err: any) {
    console.error('GMAIL SERVICE FAILED:', err.message);
  }
}

testGmailService();
