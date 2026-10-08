/**
 * Pluggable OTP Provider Interface & Concrete Adapters
 * Supports:
 * - DevConsoleOTPProvider (Default in development: logs OTP to console & returns dev preview)
 * - TwilioSMSProvider (Production SMS via Twilio REST API)
 * - MSG91SMSProvider (Production India/Global SMS via MSG91 v5 API)
 * - SendGridEmailProvider (Production Email OTP via SendGrid v3 API)
 */

export type OTPChannel = 'sms' | 'email';

export interface OTPDispatchResult {
  delivered: boolean;
  providerName: string;
  channel: OTPChannel;
  devPreviewCode?: string;
}

export interface OTPProvider {
  readonly name: string;
  sendOTP(recipient: string, otpCode: string, channel: OTPChannel): Promise<OTPDispatchResult>;
}

export class DevConsoleOTPProvider implements OTPProvider {
  readonly name = 'DevModeConsoleProvider';

  async sendOTP(recipient: string, otpCode: string, channel: OTPChannel): Promise<OTPDispatchResult> {
    console.log(
      `\n=========================================================\n` +
      `[PlanEase OTP - DEV MODE] Channel: ${channel.toUpperCase()} | To: ${recipient}\n` +
      `Verification Code: ${otpCode} (Valid for 5 minutes, max 3 attempts)\n` +
      `=========================================================\n`
    );
    return {
      delivered: true,
      providerName: this.name,
      channel,
      devPreviewCode: otpCode,
    };
  }
}

export class TwilioSMSProvider implements OTPProvider {
  readonly name = 'TwilioSMSProvider';

  async sendOTP(recipient: string, otpCode: string, channel: OTPChannel): Promise<OTPDispatchResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are missing.');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: recipient,
      From: fromNumber,
      Body: `Your PlanEase verification code is ${otpCode}. Valid for 5 minutes. Do not share this code.`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Twilio SMS failed: ${errText}`);
    }

    return {
      delivered: true,
      providerName: this.name,
      channel,
    };
  }
}

export class MSG91SMSProvider implements OTPProvider {
  readonly name = 'MSG91SMSProvider';

  async sendOTP(recipient: string, otpCode: string, channel: OTPChannel): Promise<OTPDispatchResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
      throw new Error('MSG91 credentials (MSG91_AUTH_KEY, MSG91_TEMPLATE_ID) are missing.');
    }

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: recipient.replace(/[^0-9]/g, ''),
        otp: otpCode,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MSG91 OTP send failed: ${errText}`);
    }

    return {
      delivered: true,
      providerName: this.name,
      channel,
    };
  }
}

export class SendGridEmailProvider implements OTPProvider {
  readonly name = 'SendGridEmailProvider';

  async sendOTP(recipient: string, otpCode: string, channel: OTPChannel): Promise<OTPDispatchResult> {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@planease.app';

    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is missing.');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: fromEmail, name: 'PlanEase Security' },
        subject: `${otpCode} is your PlanEase verification code`,
        content: [
          {
            type: 'text/plain',
            value: `Your PlanEase 6-digit OTP is ${otpCode}. It expires in 5 minutes.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SendGrid email dispatch failed: ${errText}`);
    }

    return {
      delivered: true,
      providerName: this.name,
      channel,
    };
  }
}

export function getConfiguredOTPProvider(): OTPProvider {
  const providerType = (process.env.OTP_PROVIDER || 'dev').toLowerCase();
  if (providerType === 'twilio') return new TwilioSMSProvider();
  if (providerType === 'msg91') return new MSG91SMSProvider();
  if (providerType === 'sendgrid') return new SendGridEmailProvider();
  return new DevConsoleOTPProvider();
}
