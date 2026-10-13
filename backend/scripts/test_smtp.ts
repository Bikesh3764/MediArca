import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function test(port: number, secure: boolean) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('Missing SMTP_USER or SMTP_PASS environment variables.');
    process.exit(1);
  }
  console.log(`Testing port ${port}, secure: ${secure}...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
      user,
      pass
    }
  });

  try {
    await transporter.verify();
    console.log(`Port ${port} SUCCESS!`);
  } catch (err: any) {
    console.error(`Port ${port} FAILED:`, err.message);
  }
}

async function main() {
  await test(587, false);
  await test(465, true);
}

main();
