const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const nocache = require('nocache');

//const common = require('./common');
const config = require('./config');
const db = require('./models');
const common = require('./common');

//init express
const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(compression());
app.use(nocache());

app.disable('etag'); //to speed things up, but I really haven't noticed much difference
app.disable('x-powered-by'); //for better security?

//parse application/json
app.use(bodyParser.json({limit: '2mb'}));  //default is 100kb
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', require('./controllers'));

//error handling
//app.use(expressWinston.errorLogger(config.logger.winston)); 
app.use(function(err, req, res, next) {
    if(typeof err == "string") err = {message: err};
    if(err instanceof Error) err = {message: err.toString()};

    //log this error
    console.error(err);

    if(err.name) switch(err.name) {
    case "UnauthorizedError":
        console.log(req.headers); //dump headers for debugging purpose..
        break;
    }
    if(err.stack) err.stack = "hidden"; //don't sent call stack to UI - for security reason
    res.status(500).json(err);
    console.log("sending json", err);
});

process.on('uncaughtException', function (err) {
    //TODO report this to somewhere!
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
});

exports.app = app;
exports.start = function(cb) {
    common.startContactCache();

    var port = process.env.PORT || config.express.port || '8081';
    var host = process.env.HOST || config.express.host || 'localhost';
    db.init((err)=>{
        if(err) return cb(err);
        var server = app.listen(port, host, function() {
            console.log("warehouse api service running on %s:%d in %s mode", host, port, app.settings.env);
        });
        
        //increase timeout for dataset download .. (default 120s)
        //without this, places like nki/s3 will timeout
        server.timeout = 300*1000; 
    });
}

