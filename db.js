'use strict';

// dotenv reads your .env file and loads each line as a process environment variable.
// This means process.env.MONGO_CLUSTER etc. become available in this file.
// IMPORTANT: dotenv only works locally. On Render (or other cloud hosts),
// you set environment variables directly in the hosting dashboard instead.
require('dotenv').config();

// MongoClient is the main class from the official MongoDB Node.js driver.
// It handles opening, reusing, and closing the connection to your database.
const { MongoClient } = require('mongodb');

// Read the three credential variables from the environment.
// Keeping them separate (instead of one big URI string) makes it easier to
// rotate just a password without touching the cluster address, and vice versa.
const cluster = process.env.MONGO_CLUSTER;
const clientId = process.env.MONGO_CLIENT_ID;
const clientSecret = process.env.MONGO_CLIENT_SECRET;

// Fail fast at startup if any required config is missing.
// It's much easier to debug a clear error message here than a cryptic
// connection timeout later.
if (!cluster || !clientId || !clientSecret) {
  throw new Error(
    'Missing MongoDB config. Ensure MONGO_CLUSTER, MONGO_CLIENT_ID, and MONGO_CLIENT_SECRET are set in your .env file (locally) or in your hosting dashboard (on Render).'
  );
}

// Build the connection URI.
// mongodb+srv:// is a special DNS-based format Atlas uses — it automatically
// discovers the cluster's servers without you needing to list IPs manually.
const uri = `mongodb+srv://${cluster}`;

// Create the MongoClient instance.
// The `auth` option passes your username and password separately rather than
// embedding them in the URI string, which is cleaner and easier to manage.
// NOTE: No connection is opened here yet — that happens inside connect() below.
const client = new MongoClient(uri, {
  auth: {
    username: clientId,   // your Atlas database username
    password: clientSecret // your Atlas database password
  }
});

// `db` is cached here so we only open ONE connection for the lifetime of the
// server process, rather than reconnecting on every API request (which would
// be slow and wasteful).
let db;

/**
 * Returns a cached database connection, creating one if it doesn't exist.
 * Reuses the connection across requests for efficiency.
 * @returns {Promise<import('mongodb').Db>} The connected database instance
 */
async function connect() {
  if (!db) {
    // client.connect() opens the actual network connection to Atlas.
    // We only do this once — the `if (!db)` check above prevents reconnecting
    // on every request.
    await client.connect();

    // client.db() selects WHICH database inside your Atlas cluster to use.
    // You can have multiple databases in one cluster; this picks 'myFirstDb'.
    db = client.db(process.env.MONGO_DB || 'myFirstDb');
    console.log('Connected to MongoDB Atlas');
  }
  return db;
}

/**
 * Retrieves the names array from the first document in the people collection.
 * @returns {Promise<string[]>} The array of names, or an empty array if none found
 */
async function getNames() {
  const database = await connect();
  const document = await database.collection('people').findOne({});
  return document ? document.names ?? [] : [];
}

/**
 * Appends a name to the names array in the people collection.
 * Uses $push to atomically add the name, and upsert to create the document if absent.
 * @param {string} name - The name to add (must be a non-empty trimmed string)
 * @returns {Promise<string[]>} The updated array of names
 */
async function addName(name) {
  const database = await connect();
  await database.collection('people').updateOne(
    {},
    { $push: { names: name } },
    { upsert: true }
  );
  return getNames();
}

/**
 * Closes the MongoDB client connection.
 * Should be called on graceful process shutdown.
 */
async function closeConnection() {
  await client.close();
  db = null;
}

module.exports = { getNames, addName, closeConnection };
