const keys = require('./keys');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
// We need to import the Redis client library
const redis = require('redis');
const { Pool } = require('pg');

// Create an Express application
const app = express();
// Allow cross-origin resource sharing
app.use(cors());
// Parse the body of any incoming requests and convert
// them to JSON
app.use(bodyParser.json());

// Create a Postgres client
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    // This is the default port for Postgres
    port: keys.pgPort
});

// Log any errors that occur when connecting to Postgres
pgClient.on('error', () => console.log('Lost PG connection'));

// Create a table in Postgres to store all the indices
// that have been submitted to the Express application
// and their corresponding Fibonacci values.
pgClient.on('connect', () => {
    pgClient
        .query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch(err => console.log(err));
});

// Create a Redis client
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    // If we ever lose connection to Redis, try to reconnect every 1 second
    retry_strategy: () => 1000
});

// We need to duplicate the connection to Redis because
// according to the docs, if we have a connection that is
// listening or publishing information, we cannot use that
// same connection to do other things. So we need to make
// a duplicate connection.
const redisPublisher = redisClient.duplicate();


// Express route handlers 

app.get('/', (req, res) => {
    res.send('Hi');
});

// Return all the indices and their corresponding
// Fibonacci values that have been submitted to the
// Express application
app.get('/values/all', async (req, res) => {
    // Get all the values from Postgres
    const values = await pgClient.query('SELECT * from values');
    // Send back all the values
    res.send(values.rows);
});

// Return all the indices and their corresponding
// Fibonacci values that have been submitted to the
// Express application
app.get('/values/current', async (req, res) => {
    // Get all the values from Redis 
    // redis does not support promises, so we need to use a callback function
    // to get the values from Redis and not use async/await
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    });
});

// Receive a new index from the React application
// and calculate the corresponding Fibonacci value
// for that index
app.post('/values', async (req, res) => {
    // Get the index from the request body
    const index = req.body.index;

    // If the index is greater than 40, send back an error
    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }

    // Insert the index into Redis
    redisClient.hset('values', index, 'Nothing yet!');
    // Publish a new insert event
    redisPublisher.publish('insert', index);
    // Insert the index into Postgres
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    // Send back an empty object
    res.send({ working: true });
});

// Listen on port 5000
app.listen(5000, err => {
    console.log('Listening');
});