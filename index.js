const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
var cors = require('cors')
const bodyParser = require('body-parser'); // Import body-parser
const compression = require("compression");
const helmet = require("helmet");
const env = require('dotenv').config()

const userRoutes = require('./users/user')
const tripRoutes = require('./trips/trip')

app.use(compression()); // Compress all routes
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      "script-src": ["'self'", "code.jquery.com", "cdn.jsdelivr.net"],
    },
  }),
);

const corsOptions = {
  origin: ['http://localhost:4200','https://main.d2zhzms6szevf5.amplifyapp.com'], // Allow all origins
  methods: 'GET,POST,PUT,DELETE,OPTIONS,PATCH', // Allowed HTTP methods
  allowedHeaders: 'Content-Type,Authorization,x-auth', // Allowed headers
  credentials: true // Allows credentials (cookies, authorization headers, etc.)
};


app.use(cors(corsOptions))

// Middleware setup
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Import authentication middleware
const authMiddleware = require('./middleware/auth.middleware');



app.use('/user', userRoutes);
app.use('/trip',authMiddleware,tripRoutes)

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}/`);
});