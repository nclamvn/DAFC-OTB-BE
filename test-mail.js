const nodemailer = require('nodemailer');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
require('dotenv').config();

async function testSMTP() {
  console.log('=== Testing SMTP ===');
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: false,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
    await transporter.verify();
    console.log('SMTP OK!');
    return true;
  } catch (e) {
    console.log('SMTP Failed:', e.message);
    return false;
  }
}

async function testGraph() {
  console.log('\n=== Testing Graph API ===');
  const mailFrom = process.env.MAIL_FROM;
  try {
    const credential = new ClientSecretCredential(
      process.env.Tenant_ID,
      process.env.Client_ID,
      process.env.Secret_key
    );
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });
    const client = Client.initWithMiddleware({ authProvider });

    const html = '<div style="font-family:Segoe UI;max-width:500px;margin:20px auto;padding:24px;border:1px solid #E8E0D6;border-radius:12px;background:#FAFAF8;"><div style="background:linear-gradient(135deg,#6B4D30,#8B6914);padding:16px 20px;border-radius:8px;margin-bottom:16px;"><h2 style="margin:0;color:#fff;font-size:16px;">DAFC OTB - Test Email</h2></div><p style="color:#333;">Graph API email is working!</p><p style="color:#666;font-size:12px;">Sent via Microsoft Graph API (Service Principal)</p></div>';

    await client.api('/users/' + mailFrom + '/sendMail').post({
      message: {
        subject: '[DAFC OTB] Test Email - Graph API',
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: mailFrom } }],
      },
      saveToSentItems: false,
    });
    console.log('Graph API OK! Email sent to', mailFrom);
    return true;
  } catch (e) {
    console.log('Graph API Failed:', e.message || e.code);
    return false;
  }
}

async function run() {
  const smtp = await testSMTP();
  if (smtp) return;
  const graph = await testGraph();
  if (graph) return;
  console.log('\nBoth methods failed!');
}

run();
