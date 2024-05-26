// https://dev.to/lukekyl/testing-your-express-js-backend-server-3ae6
const server = require('../app.js');
const supertest = require('supertest');
const requestWithSupertest = supertest(server);


const webhook = {
    aspect_type: '',
    event_time: 1716243469,
    object_id: 11458991145,
    object_type: 'activity',
    owner_id: 116528287,
    subscription_id: 258427,
    updates: { title: 'test run today' }
};

afterAll(() => {
    server.close()
})

describe('User Endpoints', () => {

    it('GET /runs should show runs', async () => {
        const res = await requestWithSupertest.get('/runs');
        expect(res.status).toEqual(200);
        expect(res.type).toEqual(expect.stringContaining('xml'));
        expect(res.text).toEqual(expect.stringContaining('<owner_id>116528287</owner_id>'));
    });

    it('post webhook create', async () => {
        webhook.aspect_type = "create";
        const sres = await requestWithSupertest.post('/webhook')
            .send(webhook);
        expect(sres.status).toEqual(200)
        expect(sres.text).toEqual(expect.stringContaining('EVENT_RECEIVED - create'));
    });

    it('post webhook update', async () => {
        webhook.aspect_type = "update";
        const ures = await requestWithSupertest.post('/webhook')
            .send(webhook);
        expect(ures.status).toEqual(200)
        expect(ures.text).toEqual(expect.stringContaining('EVENT_RECEIVED - update'));
    });

    it('post webhook delete', async () => {
        webhook.aspect_type = "delete";
        const dres = await requestWithSupertest.post('/webhook')
            .send(webhook);
        expect(dres.status).toEqual(200)
        expect(dres.text).toEqual(expect.stringContaining('EVENT_RECEIVED - delete'));
    });

});

