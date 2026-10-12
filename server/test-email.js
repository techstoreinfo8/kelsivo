
require('dotenv').config();

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  const { data, error } = await resend.emails.send({
    from: 'Kelsivo <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'Kelsivo email test',
    html: `
      <h2>Kelsivo email is working!</h2>
      <p>This is a test confirmation email.</p>
    `,
  });

  if (error) {
    console.error('Email failed:', error);
    process.exitCode = 1;
    return;
  }

  console.log('Test email accepted by Resend:', data);
}

sendTestEmail();
