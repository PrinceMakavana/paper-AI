import { OAuth2Client } from 'google-auth-library';

let testVerifier = null;

export function __setGoogleAuthVerifierForTests(verifier) {
    if (process.env.NODE_ENV !== 'test') {
        return;
    }
    testVerifier = verifier;
}

export async function verifyGoogleIdToken(idToken, audience) {
    if (testVerifier) {
        return testVerifier(idToken, audience);
    }

    const client = new OAuth2Client(audience);
    const ticket = await client.verifyIdToken({ idToken, audience });
    return ticket.getPayload();
}
