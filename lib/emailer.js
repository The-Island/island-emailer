/*
 * mailer.js: Island e-mail handling.
 *
 */

// Module Dependencies
var mailer = require('emailjs');
var pug = require('pug');
var path = require('path');
var util = require('util');
var iutil = require('island-util');
var _ = require('underscore');
var _s = require('underscore.string');

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
  if (opts.mock) {
    this.send = function(options, template, cb) {
      console.log('Mock Email to ' + options.to + ': ' + options.subject);
      cb(null);
    };
  }
};

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
    pug.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb(err);

      // create the message
      if (template.html) {
        options.attachment = [{
          data: body,
          alternative: true
        }];
      }

      // send email
      this.smtp.send(options, cb);
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
  var target;
  var owner;
  if (note.event.data.action.t === 'comment') {
    var verb = 'commented on';
    target = note.event.data.target;
    url += '/' + target.s;
    if (note.event.data.action.i === target.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === target.i) {
      owner = 'your';
    } else {
      owner = target.a + '\'s';
      verb = 'also ' + verb;
    }
    subject = '' + note.event.data.action.a + ' ' +
        verb + ' ' +
        owner + ' ';
    if (note.event.data.target.t === 'post') {
      subject += 'post';
    } else if (note.event.data.target.t === 'tick') {
      subject += 'effort on';
    }
    subject += (target.n !== '' ? ' "' + target.n + '"': '');

  } else if (note.event.data.action.t === 'hangten') {
    target = note.event.data.target;
    url += '/' + target.s;
    subject = '' + note.event.data.action.a + ' gave you a bump for ';
    if (note.event.data.target.t === 'post') {
      subject += 'your post';
    } else if (note.event.data.target.t === 'tick') {
      subject += 'your effort on';
    } else if (note.event.data.target.t === 'crag') {
      if (note.event.data.target.pn) {
        subject += 'adding the sector';
      } else {
        subject += 'adding the crag';
      }
    } else if (note.event.data.target.t === 'ascent') {
      subject += 'adding the ' + (note.event.data.target.pt === 'b' ?
          'boulder problem': 'route');
    }
    subject += (note.event.data.target.n !== '' ? ' ' +
          note.event.data.target.n + '': '') +
          (note.event.data.target.pn ? ' in ' + note.event.data.target.pn:
          (note.event.data.target.l ? ' in ' + note.event.data.target.l: '')) +
          '.';

  } else if (note.event.data.action.t === 'request') {
    url += '/' + note.event.data.action.s;
    subject = '' + note.event.data.action.a + ' ' +
        'wants to follow you on Island';

  } else if (note.event.data.action.t === 'accept') {
    url += '/' + note.event.data.action.s;
    subject = 'You are now following ' +
        note.event.data.action.a + ' on Island';

  } else if (note.event.data.action.t === 'follow') {
    url += '/' + note.event.data.action.s;
    subject = '' + note.event.data.action.a + ' ' +
        'is now following you';

  } else if (note.event.data.action.t === 'mention') {
    url += '/' + note.event.data.target.s;
    subject = '' + note.event.data.action.a + ' mentioned you on Island';
    /*
    if (note.event.data.action.i === note.event.data.target.i) {
      owner = 'their ';
    } else if (note.subscriber_id === note.event.data.target.i)
      owner = 'your ';
    else {
      owner = note.event.data.target.a + '\'s ';
    }
    if (note.event.data.target.t === 'post') {
      subject += 'in ' + owner + 'post.';
    } else if (note.event.data.target.t === 'tick') {
      subject += 'in ' + owner + 'effort'
          + (note.event.data.target.n !== '' ?
              ' on ' + note.event.data.target.n : '')
          + (note.event.data.target.l ? ', ' + note.event.data.target.l : '')
          + '.';
    } else if (note.event.data.target.t === 'crag') {
      subject += 'on the crag page for ' + note.event.data.target.n;
    } else if (note.event.data.target.t === 'ascent') {
      subject += 'on the ascent page for ' + note.event.data.target.n;
    }
    */
  }

  if (!subject) {
    return cb('Invalid email subject');
  }

  // Setup the email.
  this.send({
    to: recipient.displayName + ' <' + recipient.primaryEmail + '>',
    from: this.from,
    text: body,
    subject: subject
  }, {
    file: 'notification.pug',
    html: true,
    locals: {
      body: body || '',
      url: url,
      surl: this.baseURI + '/settings'
    }
  }, cb);
};

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
  this.db.Keys.create({member_id: member._id, token: iutil.code()},
      _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: member.displayName + ' <' + member.primaryEmail + '>',
      from: this.from,
      text: 'Reset your password: ' + this.baseURI + '/reset?t=' + key.token,
      subject: 'Island Password Reset'
    }, {
      file: 'reset.pug',
      html: true,
      locals: {
        name: member.displayName,
        url: this.baseURI + '/reset?t=' + key.token
      }
    }, cb);
  }, this));
};
