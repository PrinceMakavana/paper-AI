import { sendContactFormEmail } from '../utils/emailService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /contact
 * Body: { name, email, subject, message }
 */
const submitContact = async (req, res) => {
    try {
        const contactTo = process.env.CONTACT_FROM_EMAIL?.trim();
        if (!contactTo) {
            return res.status(503).json({ error: 'Contact form is not configured.' });
        }

        const name = req.body.name?.trim();
        const email = req.body.email?.trim().toLowerCase();
        const subject = req.body.subject?.trim();
        const message = req.body.message?.trim();

        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
        }

        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }

        if (name.length > 200 || subject.length > 300 || message.length > 5000) {
            return res.status(400).json({ error: 'One or more fields exceed the maximum length.' });
        }

        const result = await sendContactFormEmail({
            to: contactTo,
            name,
            email,
            subject,
            message,
        });

        if (result?.skipped) {
            console.log('[contact] Email skipped — contact form submission:', { name, email, subject, message });
        }

        return res.status(200).json({
            message: "Message sent. We'll get back to you shortly.",
            code: 'CONTACT_SENT',
        });
    } catch (err) {
        console.error('[contact] Failed to send contact email:', err);
        return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }
};

export { submitContact };
