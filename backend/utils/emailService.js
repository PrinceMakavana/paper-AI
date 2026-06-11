import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    const host = process.env.SMTP_HOST;
    if (!host) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
            ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASS,
              }
            : undefined,
    });

    return transporter;
}

function getFrontendUrl() {
    return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function getFromAddress() {
    return process.env.SMTP_FROM || 'PaperAI <noreply@localhost>';
}

async function sendMail({ to, subject, text, html }) {
    const mailTransporter = getTransporter();
    if (!mailTransporter) {
        console.warn(`[emailService] SMTP not configured — would send to ${to}: ${subject}`);
        console.warn(text);
        return { skipped: true };
    }

    const result = await mailTransporter.sendMail({
        from: getFromAddress(),
        to,
        subject,
        text,
        html,
    });
    console.log(`[emailService] Sent "${subject}" to ${to} (messageId: ${result.messageId})`);
    return result;
}

async function sendVerificationEmail(email, token) {
    const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    const subject = 'Verify your PaperAI email';
    const text = [
        'Welcome to PaperAI!',
        '',
        'Please verify your email address by clicking the link below:',
        verifyUrl,
        '',
        'This link expires in 24 hours.',
        '',
        'If you did not create an account, you can ignore this email.',
    ].join('\n');

    const html = `
        <p>Welcome to PaperAI!</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}">Verify email</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you did not create an account, you can ignore this email.</p>
    `;

    return sendMail({ to: email, subject, text, html });
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    const subject = 'Reset your PaperAI password';
    const text = [
        'You requested a password reset for your PaperAI account.',
        '',
        'Click the link below to set a new password:',
        resetUrl,
        '',
        'This link expires in 15 minutes.',
        '',
        'If you did not request this, you can ignore this email.',
    ].join('\n');

    const html = `
        <p>You requested a password reset for your PaperAI account.</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
    `;

    return sendMail({ to: email, subject, text, html });
}

export {
    sendVerificationEmail,
    sendPasswordResetEmail,
};
