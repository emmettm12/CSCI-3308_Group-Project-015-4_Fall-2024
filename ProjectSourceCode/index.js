// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
    extname: 'hbs',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
    host: 'db', // the database server
    port: 5432, // the database port
    database: process.env.POSTGRES_DB, // the database name
    user: process.env.POSTGRES_USER, // the user account to connect with
    password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
    .then(obj => {
        console.log('Database connection successful'); // you can view this message in the docker compose logs
        obj.done(); // success, release the connection;
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
    })
);

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.use(express.static("./views/resources"));

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get('/', (req, res) => {
    res.redirect('/home'); //this will call the /anotherRoute route in the API
});

app.get('/all', (req, res) => {
    all = `select * from users;`;
    db.task('get-everything', task => {
        return task.batch([task.any(all)]);
    })
        .then(data => {
            res.status(200).json({
                data: data[0]
            });
        })
        .catch(err => {
            console.log('Uh Oh spaghettio');
            console.log(err);
            res.status('400').json({
                data: '',
            });
        });
});

// -------------------------------------  ROUTES for register.hbs   ----------------------------------------------
const user = {
    username: undefined,
    password: undefined,
};

app.get('/register', (req, res) => {
    if (req.session.user) {
        res.render('pages/UhOh', {
            error: true,
            message: "Can't load register until you log out!",
        });
    }
    else {
    res.render('pages/register');
    }
});

app.post('/register', async (req, res) => {
    const username = req.body.username;
    const hash = await bcrypt.hash(req.body.password, 10);
    const query = 'INSERT INTO users (username, password) VALUES ($1, $2) returning * ;';
    db.any(query, [
        username,
        hash
    ])
        .then(data => {
            res.render('pages/login', {
                message: "Successfully created account!",
            });
        })
        .catch(err => {
            console.log(err);
            res.render('pages/register', {
                error: true,
                message: "Something went wrong. Either your username was invalid or is already taken!",
            });
        });
});

// -------------------------------------  ROUTES for login.hbs   ----------------------------------------------
app.get('/login', (req, res) => {
    if (req.session.user) {
        res.render('pages/UhOh', {
            error: true,
            message: "Can't load login until you log out!",
        });
    }
    else {
    res.render('pages/login', {
        message: undefined,
    });
    }
});

app.post('/login', (req, res) => {
    const username = req.body.username;
    const query = 'select * from users where users.username = $1 LIMIT 1';
    const values = [username];

    db.one(query, values)
        .then(async data => {
            user.username = data.username;
            user.password = data.password;
            const match = await bcrypt.compare(req.body.password, user.password);

            if (match) {
                req.session.user = user;
                req.session.save();

                res.redirect('/home');
            }
            else {
                res.render('pages/login', {
                    error: true,
                    message: "Incorrect password.",
                });
            }
        })
        .catch(err => {
            console.log(err);
            res.render('pages/register', {
                error: true,
                message: "No username found, maybe try registering.",
            });
        });
});

// Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
        // Default to login page.
        return res.redirect('/login');
    }
    next();
};

// Authentication Required
app.use(auth);

// -------------------------------------  ROUTES for HOME(?).hbs   ----------------------------------------------
app.get('/home', (req, res) => {
    res.render('pages/home', {
        message: undefined,
    });
});

// -------------------------------------  ROUTES for HOME(?).hbs   ----------------------------------------------
app.get('/profile', (req, res) => {
    res.render('pages/profile', {
        message: undefined,
    });
});

// -------------------------------------  ROUTES for logout.hbs   ----------------------------------------------
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout', {
        message: "Successfully Logged Out!"
    });
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');