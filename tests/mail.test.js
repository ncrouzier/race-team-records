const setUpMail = require('../config/mail');
const { toAddressList } = setUpMail;

let realFetch, sent;

beforeEach(() => {
    realFetch = global.fetch;
    sent = [];
    global.fetch = jest.fn(async (url, options) => {
        sent.push({ url, headers: options.headers, payload: JSON.parse(options.body) });
        return { ok: true, status: 201, text: async () => '{"messageId":"<m1@brevo>"}' };
    });
    setUpMail();
});

afterEach(() => {
    global.fetch = realFetch;
    delete global.transport;
});

function sendMail(options) {
    return new Promise(resolve => transport.sendMail(options, (err, info) => resolve({ err, info })));
}

describe('toAddressList', () => {
    test('reads every address form the routes use', () => {
        expect(toAddressList('a@x.org')).toEqual([{ email: 'a@x.org' }]);
        expect(toAddressList('a@x.org, b@x.org')).toEqual([{ email: 'a@x.org' }, { email: 'b@x.org' }]);
        expect(toAddressList({ name: 'Ann', address: 'a@x.org' })).toEqual([{ email: 'a@x.org', name: 'Ann' }]);
        expect(toAddressList({ address: 'a@x.org' })).toEqual([{ email: 'a@x.org' }]);
        expect(toAddressList(['a@x.org', { name: 'Bo', address: 'b@x.org' }])).toEqual([{ email: 'a@x.org' }, { email: 'b@x.org', name: 'Bo' }]);
    });

    test('is empty for a missing address', () => {
        expect(toAddressList(undefined)).toEqual([]);
        expect(toAddressList('')).toEqual([]);
        expect(toAddressList({})).toEqual([]);
    });
});

describe('transport.sendMail', () => {
    test('posts the message to Brevo', async () => {
        const { err, info } = await sendMail({
            from: { name: 'MCRRC Racing Team', address: 'team@x.org' },
            to: 'a@x.org, b@x.org',
            cc: 'c@x.org',
            bcc: ['d@x.org'],
            replyTo: { name: 'Ann', address: 'ann@x.org' },
            subject: 'Hello',
            text: 'Hi',
            html: '<p>Hi</p>'
        });
        expect(err).toBeNull();
        expect(info.messageId).toBe('<m1@brevo>');
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(sent[0].payload).toEqual({
            sender: { email: 'team@x.org', name: 'MCRRC Racing Team' },
            to: [{ email: 'a@x.org' }, { email: 'b@x.org' }],
            cc: [{ email: 'c@x.org' }],
            bcc: [{ email: 'd@x.org' }],
            replyTo: { email: 'ann@x.org', name: 'Ann' },
            subject: 'Hello',
            textContent: 'Hi',
            htmlContent: '<p>Hi</p>'
        });
    });

    test('leaves out the parts a message does not have', async () => {
        await sendMail({ from: 'team@x.org', to: 'a@x.org', replyTo: undefined, subject: 'Hello', text: 'Hi' });
        expect(sent[0].payload).toEqual({
            sender: { email: 'team@x.org' },
            to: [{ email: 'a@x.org' }],
            subject: 'Hello',
            textContent: 'Hi'
        });
    });

    test('passes a Brevo refusal to the callback', async () => {
        global.fetch = jest.fn(async () => ({ ok: false, status: 401, text: async () => 'Key not found' }));
        const { err } = await sendMail({ from: 'team@x.org', to: 'a@x.org', subject: 'Hello', text: 'Hi' });
        expect(err.message).toBe('Brevo API error 401: Key not found');
    });

    test('passes a network failure to the callback', async () => {
        global.fetch = jest.fn(async () => { throw new Error('getaddrinfo ENOTFOUND'); });
        const { err } = await sendMail({ from: 'team@x.org', to: 'a@x.org', subject: 'Hello', text: 'Hi' });
        expect(err.message).toBe('getaddrinfo ENOTFOUND');
    });

    test('calls the callback once, and logs an error the callback throws', async () => {
        const callback = jest.fn(() => { throw new Error('bug in the route'); });
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        transport.sendMail({ from: 'team@x.org', to: 'a@x.org', subject: 'Hello', text: 'Hi' }, callback);
        await new Promise(resolve => setTimeout(resolve, 20));
        try {
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBeNull();
            expect(log).toHaveBeenCalledWith('Error in an email callback:', expect.objectContaining({ message: 'bug in the route' }));
        } finally {
            log.mockRestore();
        }
    });

    test('returns a promise without a callback', async () => {
        await expect(transport.sendMail({ from: 'team@x.org', to: 'a@x.org', subject: 'Hello', text: 'Hi' }))
            .resolves.toMatchObject({ messageId: '<m1@brevo>' });
    });
});
