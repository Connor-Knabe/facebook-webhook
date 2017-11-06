var login = require('./login.js');
var port = process.env.PORT || 1333;

const express = require('express'),
    bodyParser = require('body-parser'),
    xhub = require('express-x-hub'),
    twilio = require('twilio'),
    log4js = require('log4js');

var logger = log4js.getLogger();

logger.level = 'debug';

var client = twilio(login.TWILIO_ACCOUNT_SID, login.TWILIO_AUTH_TOKEN);

const app = express();
app.use(xhub({ algorithm: 'sha1', secret: login.APP_SECRET }));
app.use(bodyParser.json());

// Sets server port and logs message on success
app.listen(process.env.PORT || port, () =>
    logger.info(`Webhook is listening on ${port}`)
);

app.get('/', (req, res) => {
    res.send('hi');
});

// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {
    let body = req.body;
    logger.debug('webhook triggered');

    if (!req.isXHubValid()) {
        logger.debug(
            'Warning - request header X-Hub-Signature not present or invalid'
        );
        res.sendStatus(401);
        return;
    }

    // Checks this is an event from a page subscription
    if (body.entry) {
        // Iterates over each entry - there may be multiple if batched

        if (body.object === 'page') {
            // Iterates over each entry - there may be multiple if batched
            body.entry.forEach(function(entry) {
                // Gets the message. entry.messaging is an array, but
                // will only ever contain one message, so we get index 0
                logger.debug('one entry', entry);
                if (entry.changes) {
                    entry.changes.forEach(change => {
                        if (change.field === 'conversations') {
                            logger.debug('convo');
                            sendText();
                        } else {
                            logger.info('recieved a non conversation event?');
                        }
                    });
                }
            });

            // Returns a '200 OK' response to all requests
            res.status(200).send('EVENT_RECEIVED');
        } else {
            // Returns a '404 Not Found' if event is not from a page subscription
            res.sendStatus(404);
        }
    }
});

function sendText() {
    var twilioRequestObj = {
        to: login.toNumber,
        from: login.fromNumber,
        body: 'Recieved Facebook Message on your page'
    };

    client.messages.create(twilioRequestObj, (err, message) => {
        if (err) {
            logger.info(
                `Error sending text message for message: ${message.body} For error: ${err}`
            );
        } else {
            logger.info(`Text sent:${message.body}`);
        }
    });
}

app.get('/webhook', (req, res) => {
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = login.facebookVerifyToken;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(403);
    }
});
