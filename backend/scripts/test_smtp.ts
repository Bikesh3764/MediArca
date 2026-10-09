import nodemailer from 'nodemailer';

async function test(port: number, secure: boolean) {
  console.log(`Testing port ${port}, secure: ${secure}...`);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
      user: 'bikeshray3764@gmail.com',
      pass: 'axoiixspzbrolayh'
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
