'use strict';
require('dotenv').config();
// Imports dependencies and sets up http server
const
    express = require('express'),
    bodyParser = require('body-parser'),
    odatasql = require('odata-v4-sql'),
    js2xmlparser = require('js2xmlparser'),
    //import src
    stravaFuncs = require('./src/strava_funcs'),
    client_id = process.env.stravaclientid,
    client_secret = process.env.stravaclientsecret,
    //requests
    axios = require('axios'),
    //database connection
    pgp = require('pg-promise')(),
    dbuser = process.env.dbusername,
    dbpwd = process.env.dbpassword,
    port = process.env.dbport,
    database = process.env.dbdbname, //where db starts with / like "/mydb"
    at = '@',
    host = process.env.dbhost, //IP Address of DB like 10.12.222.34
    con1 = 'postgres://',
    colon = ':',
    conn_string = con1 + dbuser + colon + dbpwd + at + host + colon + port + database,
    db = pgp(conn_string),
    // creates express http server
    app = express().use(bodyParser.json());




// Sets server port and logs message on success
app.listen(process.env.PORT || 8080, () => console.log('webhook is listening! UwU'));



// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {
    console.log("webhook event received!", req.body);
    console.log("webhook header: ", req.headers);
    let
        data = req.body,
        aspect_type = data.aspect_type,
        event_time = data.event_time,
        object_id = data.object_id,
        object_type = data.object_type,
        owner_id = data.owner_id,
        subscription_id = data.subscription_id,
        updates = data.updates,
        sql = "INSERT INTO api_data.webhooks (aspect_type, event_time, object_id, object_type, owner_id, subscription_id, updates) VALUES ($1, $2, $3, $4, $5, $6, $7);";
        //add iff statement to validate subscription id and owner id
    if (aspect_type == 'create'){
        db.none(sql, [aspect_type, event_time, object_id, object_type, owner_id, subscription_id, updates])
        .then(() => {
            console.log('webhook event added to db - aspect_type: ', aspect_type, ' object_id: ', object_id);
        })
        .catch(error => {
            console.log('error inserting into db');
            console.log(error)
        });

    };
    if (aspect_type == 'update') {
        console.log("Update event received");
        stravaFuncs.recordStravaActivity(db, owner_id, client_id, client_secret, object_id)
            .then((results) => {
                if (results.gear_id) {
                    stravaFuncs.recordStravaGear(db, owner_id, results.gear_id, results.access_token);
                }
            });

    }
    if (aspect_type == 'delete') {
        let del_sql = "DELETE FROM api_data.activities WHERE owner_id = $1 and object_id = $2;";
        db.none(del_sql, [owner_id, object_id])
            .then(() => {
                console.log('webhook event deleted from db - aspect_type: ', aspect_type, ' object_id: ', object_id);
                //stravaFuncs.refreshOauthToken(db, client_id, client_secret, owner_id);
            })
            .catch(error => {
                console.log('error inserting into db');
                console.log(error)
            });

    };

    res.status(200).send('EVENT_RECEIVED');
});


app.get('/runs', (req, res) => {
    const filter = odatasql.createFilter(req.query.$filter);
    db.any(`SELECT * FROM API_DATA.ACTIVITIES WHERE ${filter.where}`)
        .then(function (data) {
            res.set('Content-Type', 'application/xml');
            res.send(js2xmlparser.parse("activity", data));
            // res.status(200).json({
            //     '@odata.context': req.protocol + '://' + req.get('host') + '/api/$metadata#Activities',
            //     value: data
            // });
        });
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = "STRAVA";
    // Parses the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
        // Verifies that the mode and token sent are valid
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.json({ "hub.challenge": challenge });
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});