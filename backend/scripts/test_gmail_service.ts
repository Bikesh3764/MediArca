import nodemailer from 'nodemailer';

async function testGmailService() {
  console.log('Testing service: "gmail"...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'bikeshray3764@gmail.com',
      pass: 'axoiixspzbrolayh'
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
