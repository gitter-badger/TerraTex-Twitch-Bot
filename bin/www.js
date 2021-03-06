"use strict";

console.log();
console.log();
console.log();
console.log("////////////////////////////////////////////////////////////////////////////////////////");
console.log("////////////////////////////////////////////////////////////////////////////////////////");
console.log("////                                                                                ////");
console.log("////                                                                                ////");
console.log("////               Starting Twitchbot Server                                        ////");
console.log("////                           written by Geramy92                                  ////");
console.log("////                                    for TerraTex                                ////");
console.log("////                                                                                ////");
console.log("////                                                                                ////");
console.log("////////////////////////////////////////////////////////////////////////////////////////");
console.log("////////////////////////////////////////////////////////////////////////////////////////");
console.log();
console.log();
console.log();


let fs = require('fs');
if (fs.existsSync(__dirname + "/../production.mode")) {
    process.env.NODE_ENV = 'production';
} else {
    process.env.NODE_ENV = 'development';
}
/**
 * Additional ENV Vars
 */
let env = JSON.parse(fs.readFileSync(__dirname + "/../ENV.default.json"));

if (fs.existsSync(__dirname + "/../ENV.json")) {
    let envTmp = JSON.parse(fs.readFileSync(__dirname + "/../ENV.json"));

    for (let key in envTmp) {
        if (envTmp.hasOwnProperty(key)) {
            env[key] = envTmp[key];
        }
    }
}
global.ENV = env;



process.env.PORT = ENV.port;

if (fs.existsSync(__dirname + "/../.version")) {
    global.g_build = fs.readFileSync(__dirname + "/../.version");
} else {
    global.g_build = "0000";
}

/**
 * Save PID Files
 */
// own PID
var npid = require('npid');
try {
    var pid = npid.create('run.pid', true);
    pid.removeOnExit();
} catch (err) {
    console.log(err);
    process.exit(1);
}

//Forever pid for prod
var exec = require('child_process').exec,
    child;
var shellParser = require('node-shell-parser');

child = exec('forever list', 'shell',
    function (error, stdout) {
        let rows = stdout.split(/\r?\n/);
        rows.shift();
        let result = rows.join("\r\n");
        let array = shellParser(result);


        let foreverId = -1;
        for (let i = 0; i < array.length; i++) {
            if (array[i].uid === "TwitchBot") {
                foreverId = array[i].forever;
            }
        }

        if (foreverId !== -1) {
            fs.writeFile("runForever.pid", foreverId, function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        }
    });


/**
 * Module dependencies.
 */
var http = require('http');

var app = require('../app');
var debug = require('debug')('TerraTexTwitchBot:server');

/**
 * Get port from environment and store in Express.
 */

var calcPort = normalizePort(process.env.PORT || '9999');
app.set('port', calcPort);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
var io = require('socket.io')(server);
global.g_socket = io;

var Session = require('express-session'),
    SessionStore = require('session-file-store')(Session);
var session = Session({
    store: new SessionStore({ path: './tmp/sessions' }),
    secret: 'TerraTexBotNode',
    resave: true,
    saveUninitialized: true
});

io.use(function(socket, next) {
    session(socket.handshake, {}, next);
});

require("./../libs/sockets/socket.js");

/**
 * Listen on provided port, on all network interfaces.
 */


server.listen(calcPort);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    debug('Listening on ' + bind);
}

