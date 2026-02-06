import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const EMAIL_USER = envConfig.EMAIL_USER || process.env.EMAIL_USER;
const GOOGLE_API_CREDENTIALS_PATH = envConfig.GOOGLE_API_CREDENTIALS_PATH || process.env.GOOGLE_API_CREDENTIALS_PATH;
const GOOGLE_REFRESH_TOKEN = envConfig.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
const STUDENT_DRIVE_LINK = envConfig.STUDENT_DRIVE_LINK || process.env.STUDENT_DRIVE_LINK || '';
const ASSISTANT_DRIVE_LINK = envConfig.ASSISTANT_DRIVE_LINK || process.env.ASSISTANT_DRIVE_LINK || '';
const ADMIN_DRIVE_LINK = envConfig.ADMIN_DRIVE_LINK || process.env.ADMIN_DRIVE_LINK || '';
const SYSTEM_DOMAIN = envConfig.SYSTEM_DOMAIN || process.env.SYSTEM_DOMAIN || 'https://demosys.myvnc.com';
const SYSTEM_NAME = envConfig.SYSTEM_NAME || process.env.SYSTEM_NAME || 'Demo Attendance System';

// Initialize Gmail API client
let gmailClient = null;

function initializeGmailClient() {
  if (gmailClient) {
    return gmailClient;
  }

  if (!GOOGLE_API_CREDENTIALS_PATH || !GOOGLE_REFRESH_TOKEN || !EMAIL_USER) {
    console.error('❌ Gmail API credentials are not configured');
    return null;
  }

  try {
    // Read credentials file
    const credentialsPath = GOOGLE_API_CREDENTIALS_PATH.replace(/^"|"$/g, '');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web || {};
    
    if (!client_id || !client_secret) {
      console.error('❌ Invalid credentials file structure');
      return null;
    }

    // Create OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set refresh token
    oAuth2Client.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN
    });

    // Create Gmail API client
    gmailClient = google.gmail({ version: 'v1', auth: oAuth2Client });
    
    return gmailClient;
  } catch (error) {
    console.error('❌ Error initializing Gmail API client:', error);
    return null;
  }
}

// Create email message in RFC 2822 format
function createEmailMessage(from, to, subject, html) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html
  ].join('\n');

  // Encode message in base64url format
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generate email HTML template
function generateEmailHTML(name, role, driveLink) {
  const hasDriveLink = driveLink && driveLink.trim() !== '';
  
  let mainContent = '';
  let subject = '';
  
  if (role === 'student') {
    subject = 'Welcome to Demo Attendance System!';
    
    if (!hasDriveLink) {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're really happy to have you with us 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to explore, learn, and grow 🚀</p>
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact our <a href="${SYSTEM_DOMAIN}/contact_assistants" style="color: #0E80C7; text-decoration: underline;">assistants</a> — we're always here for you 💬❤️</p>
      `;
    } else {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're really happy to have you with us 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to explore, learn, and grow 🚀</p>
        <p style="color: white; font-size: 16px; margin: 0 0 10px 0;">🎥 Learn how our system works in minutes</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">This short video will walk you through the system and show you how to use it with ease:</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">👉 Watch the student guide: <a href="${driveLink}" style="color: #0E80C7; text-decoration: underline;">${driveLink}</a></p>
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact our <a href="${SYSTEM_DOMAIN}/contact_assistants" style="color: #0E80C7; text-decoration: underline;">assistants</a> — we're always here for you 💬❤️</p>
      `;
    }
  } else if (role === 'assistant') {
    subject = `Welcome to ${SYSTEM_NAME}!`;
    
    if (!hasDriveLink) {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're happy to have you as part of our team 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your assistant account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to start working, collaborating, and supporting our students 🚀</p>
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact <a href="${SYSTEM_DOMAIN}/contact_developer" style="color: #0E80C7; text-decoration: underline;">Tony Joseph</a> — we're always here for you 💬❤️</p>
      `;
    } else {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're happy to have you as part of our team 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your assistant account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to start working, collaborating, and supporting our students 🚀</p>
        <p style="color: white; font-size: 16px; margin: 0 0 10px 0;">🎥 Learn how our system works in minutes</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">This short video will walk you through the system and show you how to use it with ease:</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">👉 Watch the assistant guide: <a href="${driveLink}" style="color: #0E80C7; text-decoration: underline;">${driveLink}</a></p>
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact <a href="${SYSTEM_DOMAIN}/contact_developer" style="color: #0E80C7; text-decoration: underline;">Tony Joseph</a> — we're always here for you 💬❤️</p>
      `;
    }
  } else if (role === 'admin') {
    subject = `Welcome to ${SYSTEM_NAME}!`;
    
    if (!hasDriveLink) {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're happy to have you as part of our team 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your admin account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to start working, collaborating, manage assistants and supporting our students 🚀</p>
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact <a href="${SYSTEM_DOMAIN}/contact_developer" style="color: #0E80C7; text-decoration: underline;">Tony Joseph</a> — we're always here for you 💬❤️</p>
      `;
    } else {
      mainContent = `
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Welcome to our platform! 🎊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">We're happy to have you as part of our team 😊</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your admin account has been created successfully ✅</p>
        <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">You're now ready to start working, collaborating, manage assistants and supporting our students 🚀</p>
        <p style="color: white; font-size: 16px; margin: 0 0 10px 0;">🎥 Learn how our system works in minutes</p>
        <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">This short video will walk you through the system and show you how to use it with ease:</p>
        <p style="color: white; font-size: 16px; margin: 0 0 10px 0;">👉 Watch the assistantt guide: <a href="${driveLink}" style="color: #0E80C7; text-decoration: underline;">${driveLink}</a></p>
        ${ADMIN_DRIVE_LINK && ADMIN_DRIVE_LINK.trim() !== '' ? `<p style="color: white; font-size: 16px; margin: 0 0 30px 0;">👉 Watch the admin guide: <a href="${ADMIN_DRIVE_LINK}" style="color: #0E80C7; text-decoration: underline;">${ADMIN_DRIVE_LINK}</a></p>` : '<p style="color: white; font-size: 16px; margin: 0 0 30px 0;"></p>'}
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you have any questions or need help at any time, feel free to contact <a href="${SYSTEM_DOMAIN}/contact_developer" style="color: #0E80C7; text-decoration: underline;">Tony Joseph</a> — we're always here for you 💬❤️</p>
      `;
    }
  } else {
    // Unknown role, don't send email
    return null;
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2C5281; padding: 0;">
      <div style="padding: 40px 30px; background-color: #2C5281;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${SYSTEM_DOMAIN}/logo.png" alt="Logo" style="width: 100px; height: 100px; margin: 0 auto; display: block; border-radius: 10px;" />
        </div>
        ${mainContent}
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">Best regards,</p>
        <p style="color: white; font-size: 16px; margin: 5px 0 0 0;">Support Team 🤝</p>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; background-color: #2C5281;">
        <div style="color: white; font-size: 20px; font-weight: bold; font-family: sans-serif; margin-bottom: 15px; text-align: center;">${SYSTEM_NAME}</div>
        <div style="color: white; text-decoration: underline; font-size: 14px; margin-bottom: 20px; text-align: center;">
          <a href="${SYSTEM_DOMAIN}" style="color: white; text-decoration: underline;">${SYSTEM_DOMAIN.replace(/^https?:\/\//, '')}</a>
        </div>
      </div>
      <div style="border-top: 1px solid rgb(94, 88, 88); padding: 15px 30px; background-color: #2A4264;">
        <p style="color: white; font-size: 12px; margin: 0; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;
  
  return { html, subject };
}

// Send welcome email using Gmail API
export async function sendWelcomeEmail(userEmail, userName, role, driveLink = '') {
  const gmail = initializeGmailClient();
  
  if (!gmail || !EMAIL_USER) {
    console.error('❌ Gmail API is not configured. Cannot send welcome email.');
    return { success: false, error: 'Email service is not configured' };
  }
  
  if (!userEmail || !userName || !role) {
    console.error('❌ Missing required parameters for welcome email.');
    return { success: false, error: 'Missing required parameters' };
  }
  
  // Don't send email if role is not student, assistant, or admin
  if (!['student', 'assistant', 'admin'].includes(role)) {
    console.log(`⏭️  Skipping email for role: ${role}`);
    return { success: false, error: 'Email not sent for this role' };
  }
  
  try {
    const emailData = generateEmailHTML(userName, role, driveLink);
    
    if (!emailData) {
      console.log(`⏭️  No email template for role: ${role}`);
      return { success: false, error: 'No email template for this role' };
    }
    
    const from = `"${SYSTEM_NAME}" <${EMAIL_USER}>`;
    const message = createEmailMessage(from, userEmail, emailData.subject, emailData.html);
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: message
      }
    });
    
    console.log('✅ Welcome email sent successfully to:', userEmail);
    console.log('✅ Email message ID:', response.data.id);
    
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Generate password change email HTML template
function generatePasswordChangeEmailHTML(name, role) {
  let contactMessage = '';
  
  if (role === 'student') {
    contactMessage = `If this wasn't you, please contact <a href="${SYSTEM_DOMAIN}/contact_assistants" style="color: #0E80C7; text-decoration: underline;">assistants</a> immediately so we can help secure your account 💬`;
  } else if (role === 'assistant' || role === 'admin') {
    contactMessage = `If this wasn't you, please contact <a href="${SYSTEM_DOMAIN}/contact_developer" style="color: #0E80C7; text-decoration: underline;">Tony Joseph</a> immediately so we can help secure your account 💬`;
  } else {
    // Unknown role, don't send email
    return null;
  }
  
  const mainContent = `
    <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${name} 👋</p>
    <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">This is a confirmation that your account password was successfully changed 🔒</p>
    <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">If you made this change, no further action is required ✅</p>
    <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">Your account remains secure, and you can continue using the platform as usual 🚀</p>
    <p style="color: white; font-size: 16px; margin: 0 0 10px 0;">⚠️ Didn't make this change?</p>
    <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">${contactMessage}</p>
  `;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2C5281; padding: 0;">
      <div style="padding: 40px 30px; background-color: #2C5281;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${SYSTEM_DOMAIN}/logo.png" alt="Logo" style="width: 100px; height: 100px; margin: 0 auto; display: block; border-radius: 10px;" />
        </div>
        ${mainContent}
        <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">Best regards,</p>
        <p style="color: white; font-size: 16px; margin: 5px 0 0 0;">Support Team 🤝</p>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; background-color: #2C5281;">
        <div style="color: white; font-size: 20px; font-weight: bold; font-family: sans-serif; margin-bottom: 15px; text-align: center;">${SYSTEM_NAME}</div>
        <div style="color: white; text-decoration: underline; font-size: 14px; margin-bottom: 20px; text-align: center;">
          <a href="${SYSTEM_DOMAIN}" style="color: white; text-decoration: underline;">${SYSTEM_DOMAIN.replace(/^https?:\/\//, '')}</a>
        </div>
      </div>
      <div style="border-top: 1px solid rgb(94, 88, 88); padding: 15px 30px; background-color: #2A4264;">
        <p style="color: white; font-size: 12px; margin: 0; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;
  
  return { html, subject: 'Password Changed Successfully' };
}

// Send password change email using Gmail API
export async function sendPasswordChangeEmail(userEmail, userName, role) {
  const gmail = initializeGmailClient();
  
  if (!gmail || !EMAIL_USER) {
    console.error('❌ Gmail API is not configured. Cannot send password change email.');
    return { success: false, error: 'Email service is not configured' };
  }
  
  if (!userEmail || !userName || !role) {
    console.error('❌ Missing required parameters for password change email.');
    return { success: false, error: 'Missing required parameters' };
  }
  
  // Don't send email if role is not student, assistant, or admin
  if (!['student', 'assistant', 'admin'].includes(role)) {
    console.log(`⏭️  Skipping password change email for role: ${role}`);
    return { success: false, error: 'Email not sent for this role' };
  }
  
  try {
    const emailData = generatePasswordChangeEmailHTML(userName, role);
    
    if (!emailData) {
      console.log(`⏭️  No email template for role: ${role}`);
      return { success: false, error: 'No email template for this role' };
    }
    
    const from = `"${SYSTEM_NAME}" <${EMAIL_USER}>`;
    const message = createEmailMessage(from, userEmail, emailData.subject, emailData.html);
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: message
      }
    });
    
    console.log('✅ Password change email sent successfully to:', userEmail);
    console.log('✅ Email message ID:', response.data.id);
    
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('❌ Error sending password change email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
