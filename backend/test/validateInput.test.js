import { test } from 'tap';
import { requirePlainString } from '../utils/validateInput.js';

test('requirePlainString accepts non-empty strings', async (t) => {
    t.equal(requirePlainString(' abc '), 'abc');
    t.equal(requirePlainString('doc-123'), 'doc-123');
});

test('requirePlainString rejects objects and empty values', async (t) => {
    t.equal(requirePlainString({ $ne: null }), null);
    t.equal(requirePlainString(['x']), null);
    t.equal(requirePlainString(''), null);
    t.equal(requirePlainString('   '), null);
    t.equal(requirePlainString(null), null);
    t.equal(requirePlainString(undefined), null);
});
