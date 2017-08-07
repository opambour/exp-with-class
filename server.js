/*jshint esversion: 6 */

class Server {
    constructor(express, dotenv, mongoose, helmet, bodyParser, cookieParser, expressSession, methodOverride, cors, morgan, compression) {
        this._express_ = express;
        this._dotenv_ = dotenv;
        this._mongoose_ = mongoose;
        this._helmet_ = helmet;
        this._bodyParser_ = bodyParser;
        this._cookieParser_ = cookieParser;
        this._session_ = expressSession;
        this._methodOverride_ = methodOverride;
        this._cors_ = cors;
        this._morgan_ = morgan;
        this._compression_ = compression;

        // default: it comes along with express
        this._path_ = require('path');
        this._http_ = require('http');

        // initialize dotenv
        this._dotenv_.config();

        // initialize our app with express
        this.app = this._express_();
    }

    // run all methods except static methods
    init() {
        Promise.all([
            this.mongoose(),
            this.setMiddleware(),
            this.configureMiddleware(),
            this.globalLocalVariables(),
            this.routes(),
            this.main()
        ]).then(() => {
            console.log('Server running smoothly...');
        }).catch((err) => {
            console.log(err);
        });
    }

    mongoose() {
        // mongoose promise: tells mongose to use es6 promise
        this._mongoose_.Promise = global.Promise;
        // connect to mongodb database
        this._mongoose_.connection.openUri(process.env.DATABASE);

        // ---------- checking mongoose status connection
        const db = this._mongoose_.connection;

        db.on('connected', function() {
            console.log('Mongoose connected to: ' + process.env.DATABASE);
        });
        db.on('error', function(err) {
            console.log('Mongoose connection error: ' + err);
        });
        db.on('disconnected', function() {
            console.log('Mongoose disconnected: ');
        });

        // Reusable function to close Mongoose connection
        let gracefulShutdown = function(msg, callback) {
            db.close(function() {
                console.log('Mongoose disconnected through ' + msg);
                callback();
            });
        };

        // For nodemon restarts
        process.once('SIGUSR2', function() {
            gracefulShutdown('nodemon restart', function() {
                process.kill(process.pid, 'SIGUSR2');
            });
        });
        // For app termination
        process.on('SIGINT', function() {
            gracefulShutdown('app termination', function() {
                process.exit(0);
            });
        });
        // For Heroku app termination
        process.on('SIGTERM', function() {
            gracefulShutdown('Heroku app shutdown', function() {
                process.exit(0);
            });
        });

    }

    setMiddleware() {
        this.app.set('port', process.env.PORT); // port
        this.app.set('trust proxy', 1); // trust first proxy
        this.app.set('views', this._path_.join(__dirname, 'views')); // set views
        // TODO: set template engine later
    }

    configureMiddleware() {
        this.app.use(this._helmet_());

        // serving static files: HTML files, images, fonts, css and so on
        this.app.use(this._express_.static(this._path_.join(__dirname, '/public')));

        // body parser
        this.app.use(this._bodyParser_.json());
        this.app.use(this._bodyParser_.urlencoded({
            extended: true,
        }));

        // cookie parser
        this.app.use(this._cookieParser_());

        // express session
        this.app.use(this._session_({
            secret: process.env.SECRET_KEY_ONE,
            /* Security: Don’t use the default session name which is connect.sid
            * a potential attacker can use it to fingerprint the server and target attacks accordingly.
                To avoid this problem, use generic cookie names; 
            */
            name: process.env.SESSION_NAME, // make it unique from the default name 'connect.sid' for security reasons
            saveUninitialized: true, // create session until something stored
            resave: false, //don't save session if unmodified
            // cookie: { secure: true, maxAge: 3600000 * 24 }, // 60000 milliseconds = 1 minute, 300000 is 5 minutes, hour = 3600000
            // store: storeSession
        }));

        /*
            Method Override enables the faux HTTP method support. This means that if we
            would like to stimulate the DELETE and PUT method calls to our application(form), we can
            do it by adding a _method parameter to the request.
            */
        this.app.use(this._methodOverride_('_method'));

        // Middleware: configure our app to handle CORS requests
        this.app.use(this._cors_());

        // for production
        const productionSession = {
            secret: process.env.SECRET_KEY_ONE,
            cookie: {},
        };

        // ------------------- logger
        // logger, errorhandler during development
        process.env.NODE_ENV = process.env.NODE_ENV;
        // log all requests to the console
        if (process.env.NODE_ENV === 'development') {
            this.app.use(this._morgan_('dev'));
        } else if (process.env.NODE_ENV === 'production') {
            this.app.use(this._compression_());
            productionSession.cookie.secure = true; // serve secure cookies
        }
    }

    globalLocalVariables() {
        // ----- Authenticated or logged in user
        this.app.use(function(req, res, next) {
            // req.user local variable
            res.locals.user = req.user;

            if (req.user) {
                console.log(`${req.user.username} has logged in`);
            }
            console.log(`Session ID: ${req.sessionID}`);

            next();
        });
    }

    routes() {
        // index page
        this.app.get('/', function(req, res, next) {
            res.send('<h3>Web server powered by Node.js and Express.js</h3>');
            next();
        });
    }

    // create server
    main() {
        const SERVER = this._http_.Server(this.app); // create server
        const HOSTNAME = '127.0.0.1'; // localhost
        const PORT = this.app.get('port'); // get port number

        // listening to port
        SERVER.listen(PORT, HOSTNAME, function(err) {
            if (err) {
                console.log(err.message); // you can output err.stack
                return;
                // tvariableow err;
            }

            const GET_HOSTNAME = SERVER.address().address;
            console.log('Web Server running at http://%s:%s', GET_HOSTNAME, PORT);
            console.log('\npress Ctrl-C to terminate.');
        });
    }

}

// node modules

const ReqMod = {
    express: require('express'),
    dotenv: require('dotenv'),
    mongoose: require('mongoose'),
    helmet: require('helmet'),
    bodyParser: require('body-parser'),
    cookieParser: require('cookie-parser'),
    expressSession: require('express-session'),
    methodOverride: require('method-override'),
    cors: require('cors'),
    morgan: require('morgan'),
    compression: require('compression')
};

// create server instance
const App = new Server(ReqMod.express, ReqMod.dotenv, ReqMod.mongoose, ReqMod.helmet, ReqMod.bodyParser,
    ReqMod.cookieParser, ReqMod.expressSession, ReqMod.methodOverride, ReqMod.cors, ReqMod.morgan, ReqMod.compression);

// run server
App.init();