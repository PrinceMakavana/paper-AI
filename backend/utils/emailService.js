import nodemailer from 'nodemailer';

let transporter;

function isEmailDisabled() {
    if (process.env.DISABLE_EMAIL === 'true') {
        return true;
    }
    if (process.env.NODE_ENV === 'test') {
        return true;
    }
    // tap test runner (npm test)
    if (process.env.TAP) {
        return true;
    }
    return false;
}

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

async function sendMail({ to, subject, text, html, replyTo }) {
    if (isEmailDisabled()) {
        console.warn(`[emailService] Email disabled (test mode) — skipped to ${to}: ${subject}`);
        return { skipped: true };
    }

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
        ...(replyTo ? { replyTo } : {}),
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

async function sendContactFormEmail({ to, name, email, subject, message }) {
    const mailSubject = `[paperAI Contact] ${subject}`;
    const text = [
        'New contact form submission',
        '',
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        '',
        'Message:',
        message,
    ].join('\n');

    const html = `
        <p><strong>New contact form submission</strong></p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `;

    return sendMail({
        to,
        subject: mailSubject,
        text,
        html,
        replyTo: `${name} <${email}>`,
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendContactFormEmail,
};
