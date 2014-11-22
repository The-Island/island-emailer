/*
 * mailer.js: Island e-mail handling.
 *
 */

// Module Dependencies
var mailer = require('emailjstmp');
var jade = require('jade');
var path = require('path');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));

/**
 * Constructor.
 * @object options
 */
var Emailer = exports.Emailer = function (opts) {
  this.db = opts.db;
  this.from = opts.from;
  this.baseURI = opts.baseURI;
  this.smtp = mailer.server.connect({
    user: opts.user,
    password: opts.password,
    host: opts.host,
    ssl: opts.ssl,
  });
}

/**
 * Send an email.
 * @object options
 * @object template
 * @function cb
 */
Emailer.prototype.send = function (options, template, cb) {
  if ('function' === typeof template) {
    cb = template;
    template = false;
  }
  if (!this.smtp) {
    return util.error('no SMTP server connection');
  }

  if (template) {
    jade.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb(err);

      // create the message
      var message;
      if (template.html) {
        message = mailer.message.create(options);
        message.attach_alternative(body);
      } else {
        message = options;
      }
      message.text = body;

      // send email
      this.smtp.send(message, cb);
    }, this));
  } else {

    // send email
    this.smtp.send(options, cb);
  }
};

/**
 * Send a notification.
 * @object recipient
 * @object note
 * @string body
 * @function cb
 */
Emailer.prototype.notify = function (recipient, note, body, cb) {
  cb = cb || function(){};
  if (!this.baseURI) {
    return cb('baseURI required');
  }
  var url = this.baseURI;

  // Build the email subject.
  var subject;
  if (note.event.data.action.t === 'note') {
    url += '/' + note.event.data.target.s
    var verb = 'wrote a note on';
    var owner;
    if (note.event.data.action.i === note.event.data.target.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === note.event.data.target.i) {
      owner = 'your';
    } else {
      owner = note.event.data.target.a + '\'s';
      verb = 'also ' + verb;
    }
    subject = note.event.data.action.a + ' '
        + verb + ' '
        + owner + ' '
        + note.event.data.target.t
        + (note.event.data.target.n !== '' ? ' "'
        + note.event.data.target.n + '"': '');

  } else if (note.event.data.action.t === 'comment') {
    var verb = 'commented on';
    var target = note.event.data.target;
    url += '/' + target.s
    var owner;
    if (note.event.data.action.i === target.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === target.i) {
      owner = 'your';
    } else {
      owner = target.a + '\'s';
      verb = 'also ' + verb;
    }
    subject = note.event.data.action.a + ' '
        + verb + ' '
        + owner + ' '
        + target.t
        + (target.n !== '' ? ' "'
        + target.n + '"': '');

  } else if (note.event.data.action.t === 'request') {
    url += '/' + note.event.data.action.s;
    subject = note.event.data.action.a + ' '
        + 'wants to follow you';

  } else if (note.event.data.action.t === 'accept') {
    url += '/' + note.event.data.action.s;
    subject = 'You are now following '
        + note.event.data.action.a;

  } else if (note.event.data.action.t === 'follow') {
    url += '/' + note.event.data.action.s;
    subject = note.event.data.action.a + ' '
        + 'is now following you';
  }

  if (!subject) {
    return cb('Invalid email subject');
  }

  // Create a login key for this email.
  this.db.Keys.create({member_id: recipient._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: recipient.displayName + ' <' + recipient.primaryEmail + '>',
      from: this.from,
      subject: subject
    }, {
      file: 'notification.jade',
      html: true,
      locals: {
        body: body || '',
        url: url,
        surl: this.baseURI + '/settings/' + key._id.toString()
      }
    }, cb);
  }, this));
}

/**
 * Send a password reset key.
 * @object member
 * @function cb
 */
Emailer.prototype.reset = function (member, cb) {
  cb = cb || function(){};
  if (!this.baseURI) {
    return cb('baseURI required');
  }

  // Create a login key for this email.
  this.db.Keys.create({member_id: member._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: member.displayName + ' <' + member.primaryEmail + '>',
      from: this.from,
      subject: 'Island Password Reset'
    }, {
      file: 'reset.jade',
      html: true,
      locals: {
        name: member.displayName,
        url: this.baseURI + '/reset?t=' + key._id.toString()
      }
    }, cb);
  }, this));
}
