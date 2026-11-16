const { MAX_ATTEMPTS, makeCode, hashCode, cleanCode, checkCode } = require('../app/loginCodes');

const NOW = new Date('2026-11-15T12:00:00Z').getTime();

function account(code, extra) {
    return Object.assign({
        _id: 'u1',
        magicLoginCodeHash: hashCode('u1', code),
        magicLoginCodeAttempts: 0,
        magicLoginTokenExpires: new Date(NOW + 10 * 60 * 1000)
    }, extra);
}

describe('makeCode', () => {
    test('is always six digits, leading zeros kept', () => {
        for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^\d{6}$/);
    });
});

describe('hashCode', () => {
    test('is tied to the account', () => {
        expect(hashCode('u1', '123456')).not.toBe(hashCode('u2', '123456'));
        expect(hashCode('u1', '123456')).toBe(hashCode('u1', '123456'));
    });
});

describe('cleanCode', () => {
    test('drops the spaces and dashes typed with it', () => {
        expect(cleanCode(' 042 917 ')).toBe('042917');
        expect(cleanCode('042-917')).toBe('042917');
        expect(cleanCode(null)).toBe('');
    });
});

describe('checkCode', () => {
    test('the right code, in time', () => {
        expect(checkCode(account('042917'), '042917', NOW)).toBe('ok');
        expect(checkCode(account('042917'), '042 917', NOW)).toBe('ok');
    });

    test('a wrong code, or not six digits', () => {
        expect(checkCode(account('042917'), '042918', NOW)).toBe('wrong');
        expect(checkCode(account('042917'), '42917', NOW)).toBe('wrong');
        expect(checkCode(account('042917'), 'abcdef', NOW)).toBe('wrong');
    });

    test('another account\'s code does not work here', () => {
        const other = account('042917', { magicLoginCodeHash: hashCode('u2', '042917') });
        expect(checkCode(other, '042917', NOW)).toBe('wrong');
    });

    test('expired, or never sent', () => {
        expect(checkCode(account('042917', { magicLoginTokenExpires: new Date(NOW - 1) }), '042917', NOW)).toBe('expired');
        expect(checkCode(account('042917', { magicLoginCodeHash: undefined }), '042917', NOW)).toBe('expired');
        expect(checkCode(null, '042917', NOW)).toBe('expired');
    });

    test('locked after too many tries, even with the right code', () => {
        expect(checkCode(account('042917', { magicLoginCodeAttempts: MAX_ATTEMPTS }), '042917', NOW)).toBe('locked');
        expect(checkCode(account('042917', { magicLoginCodeAttempts: MAX_ATTEMPTS - 1 }), '042917', NOW)).toBe('ok');
    });
});
