var _ = require('underscore');
var assert = require('assert');
var boots = require('island-boots');
var Emailer = require('../lib/emailer').Emailer;

var config = {};
_.each(require('./config.json'), function (v, k) {
  config[k] = v;
});

var member = {
  "displayName": "Sander Pick",
  "primaryEmail": "sander@island.io"
}

var notification = {
  "_id" : "51f84e397f6fa8395c00000d",
  "subscriber_id" : "4dc79a601104feb30b000e75",
  "subscription_id" : "51f826917f6fa8395c000005",
  "read" : false,
  "event" : {
    "_id" : "51f84e397f6fa8395c00000b",
    "action_id" : "51f84e397f6fa8395c00000a",
    "action_type" : "comment",
    "actor_id" : "4dc78c61ed47376c0b000001",
    "data" : {
      "action" : {
        "i" : "4dc78c61ed47376c0b000001",
        "a" : "Tester",
        "g" : "ac38ba214848deb3184905444d9dc9f3",
        "t" : "comment",
        "b" : "Haha amazing!"
      },
      "target" : {
        "i" : "4dc79a601104feb30b000e75",
        "a" : "Cooper Roberts",
        "n" : "Test post",
        "t" : "post",
        "s" : "test/test"
      }
    },
    "target_id" : "51f826917f6fa8395c000003"
  }
}

describe('island-emailer', function() {
  this.timeout(10000);
  var db;
  var emailer;

  before(function(done) {
    boots.start(function (client) {
      db = client.get('db');
      emailer = new Emailer({
        db: client.get('db'),
        user: config.GMAIL_USER,
        password: config.GMAIL_PASSWORD,
        from: config.GMAIL_FROM,
        host: config.GMAIL_HOST,
        ssl: config.GMAIL_SSL,
        baseURI: 'https://test.island.io',
        mock: false
      });
      member._id = db.oid()
      done();
    });
  });

  describe('#reset()', function() {
    it('should send a password reset email', function(done) {
      emailer.reset(member, function(err) {
        if (err) done(err);
        done();
      });
    });
  });

  describe('#notify()', function() {
    it('should send a notify email', function(done) {
      emailer.notify(member, notification, 'this is a test', function(err) {
        if (err) done(err);
        done();
      });
    });
  });
});
