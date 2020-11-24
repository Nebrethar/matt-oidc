const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
var crypto = require('crypto');

const db = low(new Memory());

const assert = require('assert');
var json = require('./users.json');

db.defaults({
  users: json,
}).write();

class Account {
  // This interface is required by oidc-provider
  static async findAccount(ctx, id) {
    // This would ideally be just a check whether the account is still in your storage
    const account = db.get('users').find({ id }).value();
    if (!account) {
      return undefined;
    }
    console.log("ACCOUNT CTX: " + ctx.toString());
    console.log("ACCOUNT ID " + id);
    return {
      accountId: id,
      // and this claims() method would actually query to retrieve the account claims
      async claims() {
        return {
          sub: id,
          email: account.email,
          email_verified: account.email_verified,
        };
      },
    };
  }

  // This can be anything you need to authenticate a user
  static async authenticate(email, password) {
    try {
      console.log("AUTHENTICATE ATTEMPT");
      assert(password, 'password must be provided');
      assert(email, 'email must be provided');
      const lowercased = String(email).toLowerCase();
      console.log("EMAIL: " + lowercased);
      //console.log("ACCOUNT: " + str(db.get('users')))
      //const account = db.get('users').find({ email: lowercased });
      //const account = db.get('users').value().find({ email: lowercased });
      //const account = db.get('users').find({ email: lowercased }).value();
      var json = require('./users.json');
      const account = db.get('users').value()[0][lowercased];
      console.log("ACCOUNT?");
      console.log(account);
      console.log("OBJECT");
      console.log("USERS");
      console.log(db.get('users'));
      console.log("AUTH CHECK STEP 1");
      //assert(account, 'invalid credentials provided');
      const chash = crypto.createHash('md5').update(password).digest("hex")
      console.log("CHECK VALUE: " + chash);
      console.log("CHECKING AGAINST " + account.hash);
      if(account.hash==chash) {
          console.log("RETURNING: " + account.id);
          return account.id;
      } else {
          return undefined;
      }
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }
}

module.exports = Account;
