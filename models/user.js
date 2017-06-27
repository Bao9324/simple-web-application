var mongodb = require('./db');
var crypto = require('crypto');

function User(user) {
  this.name = user.name;
  this.password = user.password;
  this.email = user.email;
};

module.exports = User;

//store users information
User.prototype.save = function(callback) {
  var md5 = crypto.createHash('md5'),
    email_MD5 = md5.update(this.email.toLowerCase()).digest('hex');
    //users information
  var user = {
    name: this.name,
    password: this.password,
    email: this.email
    };
  //open database
  mongodb.open(function (err, db) {
    if (err) {
    return callback(err);
    }
    //read users
    db.collection('users', function (err, collection) {
    if (err) {
    mongodb.close();
    return callback(err);
    }
    //insert user information into collection
    collection.insert(user, {
    safe: true
    }, function (err, user) {
    mongodb.close();
    if (err) {
    return callback(err);
    }
    callback(null, user[0]);
    });
   });
 });
};

//read users information
User.get = function(name, callback) {
  mongodb.open(function (err, db) {
    if (err) {
    return callback(err);
    }
    db.collection('users', function (err, collection) {
    if (err) {
    mongodb.close();
    return callback(err);
    }
    //find username(name key)
    collection.findOne({
    name: name
    }, function (err, user) {
    mongodb.close();
    if (err) {
    return callback(err);
    }
    callback(null, user);
    });
   });
 });
};
