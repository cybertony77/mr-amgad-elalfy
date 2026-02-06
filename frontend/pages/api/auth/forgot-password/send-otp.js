import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';
const EMAIL_USER = envConfig.EMAIL_USER || process.env.EMAIL_USER;
const GOOGLE_API_CREDENTIALS_PATH = envConfig.GOOGLE_API_CREDENTIALS_PATH || process.env.GOOGLE_API_CREDENTIALS_PATH;
const GOOGLE_REFRESH_TOKEN = envConfig.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
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

// Generate 8-digit random OTP
function generateOTP() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;

  console.log('📧 Send OTP request received:', { id, hasEmailConfig: !!(EMAIL_USER && GOOGLE_API_CREDENTIALS_PATH && GOOGLE_REFRESH_TOKEN) });

  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  let client;
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    console.log('✅ Connected to database');

    // Check if user exists (can be number or string)
    const userId = /^\d+$/.test(id) ? Number(id) : id;
    console.log('🔍 Searching for user with ID:', userId, 'or', id);
    
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: id }
      ]
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, hasEmail: !!user.email });

    if (!user.email) {
      console.log('❌ User does not have email');
      return res.status(400).json({ error: 'User does not have an email address' });
    }

    // Check resend_expiration - only send if null or expired
    const resendExpiration = user.OTP_rest_password?.resend_expiration;
    const now = new Date();
    
    if (resendExpiration) {
      const expirationDate = new Date(resendExpiration);
      if (now < expirationDate) {
        // Still in cooldown period
        console.log('⏳ Resend cooldown active, cannot send email yet');
        return res.status(429).json({ 
          success: false, 
          error: 'Please wait before requesting another OTP',
          resend_expiration: resendExpiration
        });
      }
    }

    // Get user name
    let userName = user.name || 'User';
    
    // If user is a student (numeric ID), get name from students collection
    // For other roles (assistant, admin, developer), use name from users collection
    if (typeof userId === 'number' && user.role === 'student') {
      const student = await db.collection('students').findOne({ id: userId });
      if (student && student.name) {
        userName = student.name;
      }
    }

    // Generate OTP (but don't save to DB yet - only save after successful email send)
    const otpCode = generateOTP();
    const hashedOTP = await bcrypt.hash(otpCode, 10);
    
    // Set expiration to 10 minutes from now
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 10);

    // Set resend expiration to 5 minutes from now
    const resendExpirationDate = new Date();
    resendExpirationDate.setMinutes(resendExpirationDate.getMinutes() + 5);

    // Check if Gmail API is configured
    const gmail = initializeGmailClient();
    if (!gmail || !EMAIL_USER) {
      console.error('❌ Gmail API is not configured.');
      console.error('❌ EMAIL_USER from env.config:', !!envConfig.EMAIL_USER);
      console.error('❌ GOOGLE_API_CREDENTIALS_PATH from env.config:', !!envConfig.GOOGLE_API_CREDENTIALS_PATH);
      console.error('❌ GOOGLE_REFRESH_TOKEN from env.config:', !!envConfig.GOOGLE_REFRESH_TOKEN);
      return res.status(500).json({ 
        error: 'Email service is not configured. Please contact administrator.',
        debug: process.env.NODE_ENV === 'development' ? {
          envConfigKeys: Object.keys(envConfig),
          hasEmailUser: 'EMAIL_USER' in envConfig,
          hasGoogleCredentialsPath: 'GOOGLE_API_CREDENTIALS_PATH' in envConfig,
          hasGoogleRefreshToken: 'GOOGLE_REFRESH_TOKEN' in envConfig
        } : undefined
      });
    }

    console.log('📧 Attempting to send OTP email to:', user.email);
    console.log('🔑 Generated OTP code:', otpCode);
    console.log('👤 User name:', userName);
    console.log('📧 Using email from:', EMAIL_USER);

    try {
      const emailHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2C5281; padding: 0;">
          <div style="padding: 40px 30px; background-color: #2C5281;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${SYSTEM_DOMAIN}/logo.png" alt="Logo" style="width: 100px; height: 100px; margin: 0 auto; display: block; border-radius: 10px;" />
            </div>
            <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${userName},</p>
            <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">Welcome to our platform! To reset your password, please use this OTP code:</p>
            <div style="background-color: #2A4264; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #0E80C7;">
              <div style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: 'Roboto, Sans-serif';">${otpCode}</div>
            </div>
            <p style="color: white; font-size: 16px; margin: 20px 0;">This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
            <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you didn't request this, please ignore this email or contact our support team.</p>
            <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">Best regards,</p>
            <p style="color: white; font-size: 16px; margin: 5px 0 0 0;">Support Team</p>
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

      const from = `"${SYSTEM_NAME}" <${EMAIL_USER}>`;
      const message = createEmailMessage(from, user.email, "Password Reset OTP Code", emailHTML);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log('✅ Email sent successfully');
      console.log('✅ Email message ID:', response.data.id);
      
      // Email sent successfully - NOW save OTP to database
      const emailId = response.data.id || `gmail-${Date.now()}`;
      console.log('✅ Email sent successfully with ID:', emailId);
      await db.collection('users').updateOne(
        { id: user.id },
        {
          $set: {
            OTP_rest_password: {
              OTP: hashedOTP,
              OTP_Expiration_Date: expirationDate,
              resend_expiration: resendExpirationDate,
              used: false
            }
          }
        }
      );
      console.log('✅ OTP saved to database after successful email send');

      res.json({ 
        success: true, 
        message: 'OTP sent to email',
        email_id: emailId,
        resend_expiration: resendExpirationDate
      });
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      console.error('❌ Email error message:', emailError?.message);
      console.error('❌ Email error code:', emailError?.code);
      console.error('❌ Email error stack:', emailError?.stack);
      
      // Handle Gmail API errors
      let errorMessage = 'Failed to send email';
      let errorDetails = null;

      if (emailError?.message) {
        errorMessage = emailError.message;
        errorDetails = { 
          message: emailError.message, 
          code: emailError.code
        };
      }

      // Check for common Gmail API errors
      const errorMsgLower = errorMessage.toLowerCase();
      if (errorMsgLower.includes('invalid grant') || 
          errorMsgLower.includes('invalid token') ||
          errorMsgLower.includes('token expired')) {
        errorMessage = 'Gmail API authentication failed. Please verify GOOGLE_REFRESH_TOKEN in env.config.';
      } else if (errorMsgLower.includes('rate limit') || 
                 errorMsgLower.includes('quota exceeded')) {
        errorMessage = 'Email sending rate limit exceeded. Please try again later.';
      } else if (errorMsgLower.includes('invalid credentials') ||
                 errorMsgLower.includes('unauthorized')) {
        errorMessage = 'Gmail API credentials are invalid. Please check GOOGLE_API_CREDENTIALS_PATH and GOOGLE_REFRESH_TOKEN in env.config.';
      }

      // Return detailed error for debugging
      res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        debug: process.env.NODE_ENV === 'development' ? {
          hasEmailUser: !!EMAIL_USER,
          hasGoogleCredentialsPath: !!GOOGLE_API_CREDENTIALS_PATH,
          hasGoogleRefreshToken: !!GOOGLE_REFRESH_TOKEN,
          errorCode: emailError?.code,
          errorMessage: emailError?.message
        } : undefined
      });
    }
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.', details: error.message });
  } finally {
    if (client) await client.close();
  }
}

