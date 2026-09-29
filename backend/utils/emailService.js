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

function formatInrAmount(amountInr) {
    return `₹${Number(amountInr).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatPurchaseDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

async function sendPurchaseConfirmationEmail({
    name,
    email,
    orderId,
    productTitle,
    amountInr,
    purchaseDate,
    paymentMethod = 'Razorpay',
}) {
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeOrderId = escapeHtml(orderId);
    const safeTitle = escapeHtml(productTitle);
    const priceLabel = formatInrAmount(amountInr);
    const dateLabel = formatPurchaseDate(purchaseDate || new Date());
    const methodLabel = escapeHtml(paymentMethod);

    const subject = `Purchase confirmed — ${productTitle}`;
    const text = [
        `Hi ${name},`,
        '',
        'Thanks for your order. We have received your payment.',
        '',
        `Order: ${orderId} (${dateLabel})`,
        `Product: ${productTitle}`,
        `Quantity: 1`,
        `Amount: ${priceLabel}`,
        `Payment method: ${paymentMethod}`,
        '',
        'Billing:',
        name,
        email,
        '',
        '— paperAI',
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-collapse:collapse;">
          <tr>
            <td style="padding:20px 24px 8px;text-align:center;font-size:14px;color:#111;">paperAI</td>
          </tr>
          <tr>
            <td style="background:#6b46c1;color:#ffffff;text-align:center;padding:28px 24px;font-size:28px;font-weight:700;">
              Thank you for your order
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;font-size:15px;line-height:1.5;">
              Hi ${safeName},
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px;font-size:15px;line-height:1.5;">
              Thanks for your order. We have received your payment and your purchase is confirmed.
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 16px;font-size:16px;font-weight:700;color:#6b46c1;">
              [Order #${safeOrderId}] (${escapeHtml(dateLabel)})
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #e5e5e5;">
                <tr>
                  <th align="left" style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:13px;">Product</th>
                  <th align="center" style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:13px;">Quantity</th>
                  <th align="right" style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:13px;">Price</th>
                </tr>
                <tr>
                  <td style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:14px;">${safeTitle}</td>
                  <td align="center" style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:14px;">1</td>
                  <td align="right" style="padding:12px 8px;border-bottom:1px solid #e5e5e5;font-size:14px;">${escapeHtml(priceLabel)}</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
                <tr>
                  <td style="padding:8px;font-size:14px;">Subtotal:</td>
                  <td align="right" style="padding:8px;font-size:14px;">${escapeHtml(priceLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-size:14px;">Payment method:</td>
                  <td align="right" style="padding:8px;font-size:14px;">${methodLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-size:15px;font-weight:700;">Total:</td>
                  <td align="right" style="padding:8px;font-size:15px;font-weight:700;">${escapeHtml(priceLabel)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px;font-size:16px;font-weight:700;color:#6b46c1;">
              Billing address
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 32px;font-size:14px;line-height:1.6;">
              ${safeName}<br />
              <a href="mailto:${safeEmail}" style="color:#333;text-decoration:none;">${safeEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px;font-size:15px;line-height:1.5;">
              <strong>Note:</strong> We are processing orders manually. It may take 1-2 business days to receive your order.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return sendMail({ to: email, subject, text, html });
}

export {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendContactFormEmail,
    sendPurchaseConfirmationEmail,
};
