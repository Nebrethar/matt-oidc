// see previous example for the things that are not commented
var crypto = require('crypto');
const fs = require("fs");
const assert = require('assert');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const Provider = require('oidc-provider');
/*
assert(process.env.HEROKU_APP_NAME, 'process.env.HEROKU_APP_NAME missing');
assert(process.env.PORT, 'process.env.PORT missing');
assert(process.env.SECURE_KEY, 'process.env.SECURE_KEY missing, run `heroku addons:create securekey`');
assert.equal(process.env.SECURE_KEY.split(',').length, 2, 'process.env.SECURE_KEY format invalid');
assert(process.env.REDIS_URL, 'process.env.REDIS_URL missing, run `heroku-redis:hobby-dev`');
*/
const RedisAdapter = require('./redis_adapter');
const jwks = require('./jwks.json');

// simple account model for this application, user list is defined like so
const Account = require('./account');

const oidc = new Provider(`http://facetrust.io:3000`, {
  adapter: RedisAdapter,
  clients: [
    {
      client_id: 'foo@example.com',
      client_secret: 'bar',
      grant_types: ['authorization_code'],
      redirect_uris: ['http://sharp.guillotine.io', 'http://news.guillotine.io', 'http://seangoggins.net', 'http://news.guillotine.io/wp-admin/admin-ajax.php?action=openid-connect-authorize'],
    },
  ],
  jwks,

  // oidc-provider only looks up the accounts by their ID when it has to read the claims,
  // passing it our Account model method is sufficient, it should return a Promise that resolves
  // with an object with accountId property and a claims method.
  findAccount: Account.findAccount,

  // let's tell oidc-provider you also support the email scope, which will contain email and
  // email_verified claims
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
  },

  // let's tell oidc-provider where our own interactions will be
  // setting a nested route is just good practice so that users
  // don't run into weird issues with multiple interactions open
  // at a time.
  interactions: {
    url(ctx) {
      return `/interaction/${ctx.oidc.uid}`;
    },
  },
  features: {
    // disable the packaged interactions
    devInteractions: { enabled: false },
    clientCredentials: { enabled: true },
    introspection: { enabled: true },
    revocation: { enabled: true },
  },
});
console.log(oidc.findAccount);
//oidc.proxy = true;
//oidc.keys = process.env.SECURE_KEY.split(',');

// let's work with express here, below is just the interaction definition
const expressApp = express();
expressApp.set('trust proxy', true);
expressApp.set('view engine', 'ejs');
expressApp.set('views', path.resolve(__dirname, 'views'));

const parse = bodyParser.urlencoded({ extended: false });

function setNoCache(req, res, next) {
//  res.header('X-Forwarded-Proto','HTTPS');
//  res.set('Pragma', 'no-cache');
//  res.set('Cache-Control', 'no-cache, no-store');
  next();
}

expressApp.get('/interaction/:uid', setNoCache, async (req, res, next) => {
  console.log('/interaction/:uid');
  try {
    const details = await oidc.interactionDetails(req, res);
    console.log(details);
    const { uid, prompt, params } = details;

    const client = await oidc.Client.find(params.client_id);
    console.log("CLIENT:" + client);

    if (prompt.name === 'login') {
      return res.render('login', {
        client,
        uid,
        details: prompt.details,
        params,
        title: 'Sign-in',
        flash: undefined,
      });
    }

    return res.render('interaction', {
      client,
      uid,
      details: prompt.details,
      params,
      title: 'Authorize',
    });
  } catch (err) {
    return console.log(err);
  }
});

var urlParser = bodyParser.urlencoded({ extended: false })

expressApp.get('/interaction/:uid/create', setNoCache, async (req, res) => {
  const uid = req.params.uid
  res.render('create', {
      uid
    });
});

expressApp.post('/interaction/:uid/create/new', setNoCache, parse, async (req, res, next) => {
  console.log("Working!");
  const uid = req.params.uid
  var email = req.body.email
  var pw1 = req.body.password
  var pw2 = req.body.passworda
  var users = require('./users.json');
  fs.writeFile("users.json.bak", JSON.stringify(users, null, 2), err => {
    if(err) {
      console.log(err)
    }
  });
  if (pw1 == pw2) {
    if (!users[0][email]) {
      users[0][email] = {
                 "id": Math.floor(100000000 + Math.random() * 900000000),
                 "email": email,
                 "hash": crypto.createHash('md5').update(pw1).digest("hex")
                 }
      fs.writeFile("users.json", JSON.stringify(users, null, 2), err => {
        if(err) {
          console.log(err)
        }
      const ud = null;
      });
      res.render('login', {
        uid,
        title: 'Sign-in',
        flash: 'Account Successfully Created!',
      });
    } else {
      //TODO: Add a real error here and directly below
      console.log("User Exists!")
    }
  } else {
    //TODO: Add a real error here and directly above
    console.log("Passwords do not match!")
  }
});

expressApp.post('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
  try {
    const { uid, prompt, params } = await oidc.interactionDetails(req, res);
    const client = await oidc.Client.find(params.client_id);

    const accountId = await Account.authenticate(req.body.email, req.body.password);
    if (!accountId) {
      console.log("NO ACCOUNT ID");
      res.render('login', {
        client,
        uid,
        details: prompt.details,
        params: {
          ...params,
          login_hint: req.body.email,
        },
        title: 'Sign-in',
        flash: 'Invalid username or password.',
      });
      return;
    }

    const result = {
      login: {
        account: accountId,
      },
    };

    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
  } catch (err) {
    console.log("LOGIN ERROR");
    next(err);app.use(express.bodyParser());
  }
});

expressApp.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
  console.log('/interaction/:uid/confirm');
  try {
    const result = {
      consent: {
        // rejectedScopes: [], // < uncomment and add rejections here
        // rejectedClaims: [], // < uncomment and add rejections here
      },
    };
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
  } catch (err) {
    next(err);
  }
});

expressApp.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
  console.log('/interaction/:uid/abort');
  try {
    const result = {
      error: 'access_denied',
      error_description: 'End-User aborted interaction',
    };
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
  } catch (err) {
    next(err);
  }
});
console.log("STARTING");

// leave the rest of the requests to be handled by oidc-provider, there's a catch all 404 there
expressApp.use(oidc.callback);

// express listen
expressApp.listen('3000');
