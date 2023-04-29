const keys = require('./keys');
const redis = require('redis');

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
const sub = redisClient.duplicate();

// This is the actual Fibonacci calculation function
// that will be called whenever a new value is inserted
// into Redis.
function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
}

// Whenever we get a new value inserted into Redis, we
// will calculate the Fibonacci value for that index and
// insert it back into Redis.
sub.on('message', (channel, message) => {
    redisClient.hset('values', message, fib(parseInt(message)));
});

// Whenever a new value is inserted into Redis, we will
// calculate the Fibonacci value for that index and insert
// it back into Redis.
sub.subscribe('insert');