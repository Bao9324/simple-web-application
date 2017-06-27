var path = require('path');

var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var flash = require('connect-flash');
var multer  = require('multer');
var formidable = require('formidable');

var settings = require('./settings');

const fs = require('fs');
const url = require('url');
var accessLog = fs.createWriteStream('access.log', {flags: 'a'});
var errorLog = fs.createWriteStream('error.log', {flags: 'a'});
var form = new formidable.IncomingForm();
var app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(logger({stream: accessLog}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: settings.cookieSecret,
  key: settings.db,//cookie name
  cookie: {maxAge: 1000 * 60 * 60 * 24 * 30},//30 days
  store: new MongoStore({
    db: settings.db,
    host: settings.host,
    port: settings.port
  })
}));
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));


app.use(function (err, req, res, next) {
  var meta = '[' + new Date() + '] ' + req.url + '\n';
  errorLog.write(meta + err.stack + '\n');
  next();
});

app.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var crypto = require('crypto');
var User = require('./models/user.js');
var storage = multer.diskStorage({
  destination: function(req, file, callback) {
    callback(null, './public/images');
  },
  filename: function(req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now() + '.jpg');
  }
});
var post = multer({storage: storage}).single('userPhoto');
  app.get('/', function (req, res) {
    fs.readFile('photos.json', function(err, data) {
    if(err){
      throw err;
    }
    json_data = JSON.parse(data.toString());
    var images_list_length = json_data.images.length;
    var cursor = 0; //Keeps track of current set of images
    if(req.query.cursor){
      cursor = parseInt(req.query.cursor);
    }
    var start = 0;
    var end = 10;
    if(req.query['next'] === ''){
      start = cursor+10;
      if(start > images_list_length){
        start = cursor;
      }
      end = start + 10;
      if(end>images_list_length){
        end = images_list_length;
      }
    }
    if(req.query['prev'] === '') {
      start = cursor-10;
      if(start<0) {
        start=0;
      }
      end = start+10;
    }
    res.render('index', {
        title: 'Welcome to Baogram',
        images: json_data.images.reverse().slice(start, end),
        cursor: start,
        user: req.session.user,
        success: req.flash('success').toString(),
        error: req.flash('error').toString()
    });
  });
});
  app.get('/reg', checkNotLogin);
  app.get('/reg', function (req, res) {
    res.render('reg', {
      title: 'Sign up',
      user: req.session.user,
      success: req.flash('success').toString(),
      error: req.flash('error').toString()
    });
  });

  app.post('/reg', checkNotLogin);
  app.post('/reg', function (req, res) {
    var name = req.body.name,
        password = req.body.password,
        password_re = req.body['confirm_password'];
    //check whether the two times inputs are same
    if (password_re != password) {
      req.flash('error', 'Please confirm the password!'); 
      return res.redirect('/reg');//return reg
    }
    //md5 value of password
    var md5 = crypto.createHash('md5'),
        password = md5.update(req.body.password).digest('hex')
    var newUser = new User({
        name: req.body.name,
        password: password,
        email: req.body.email
    });
    //check whether the username exists 
    User.get(newUser.name, function (err, user) {
      if (user) {
        req.flash('error', 'Sorry, username already taken!');
        return res.redirect('/reg');
      }
      //if not, update the new user
      newUser.save(function (err, user) {
        if (err) {
          req.flash('error', err);
          return res.redirect('/reg');
        }
        req.session.user = user;//store information to session
        req.flash('success', 'Success!');
        res.redirect('/');
      });
    });
  });

  app.get('/login', checkNotLogin);
  app.get('/login', function (req, res) {
    res.render('login', {
      title: 'Sign in',
      user: req.session.user,
      success: req.flash('success').toString(),
      error: req.flash('error').toString()
    }); 
  });

  app.post('/login', checkNotLogin);
  app.post('/login', function (req, res) {
    var md5 = crypto.createHash('md5'),
        password = md5.update(req.body.password).digest('hex');
    //check whether user exists
    User.get(req.body.name, function (err, user) {
      if (!user) {
        req.flash('error', 'User not exist!'); 
        return res.redirect('/login');
      }
      //check password
      if (user.password != password) {
        req.flash('error', 'Wrong password!'); 
        return res.redirect('/login');
      }
      //if the username and password are both correct, to session
      req.session.user = user;
      req.flash('success', 'Success!');
      res.redirect('/');
    });
  });

  app.get('/post', checkLogin);
  app.get('/post', function (req, res) {
    res.render('post', {
      title: 'Upload',
      user: req.session.user,
      success: req.flash('success').toString(),
      error: req.flash('error').toString()
    });
  });

  app.post('/api/photo', checkLogin);
  app.post('/api/photo', function(req, res){
  // upload images
  post(req, res, function(err) {
    if(err) {
      console.log(err);
      return res.end("Error!");
    }
    fs.readFile('photos.json', function(err, data) {
      if(err){
        throw err;
      }
      json_data = JSON.parse(data.toString());
      // Add new image to the JSON object and write it back to `photos.json`
      json_data.images.push({
        "path" : req.file.filename,
        "caption" : req.body.caption,
        "user": req.session.user
      });
      fs.writeFile('photos.json', JSON.stringify(json_data), function(err) {
        if(err){
          throw err;
        }
      });
    });
    res.redirect(url.parse('/').pathname);
    });
  });

  app.get('/logout', checkLogin);
  app.get('/logout', function (req, res) {
    req.session.user = null;
    req.flash('success', 'Log out...');
    res.redirect('/');
  });

  app.use(function (req, res) {
    res.render("404");
  });

  function checkLogin(req, res, next) {
    if (!req.session.user) {
      req.flash('error', 'Not log in!'); 
      return res.redirect('/login');
    }
    next();
  }

  function checkNotLogin(req, res, next) {
    if (req.session.user) {
      req.flash('error', 'Already logged in!'); 
      return res.redirect('back');
    }
    next();
  }