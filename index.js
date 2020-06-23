'use strict';
const express = require('express');
const bodyparser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const dbPool = require('./middleware/dbConnectionPool');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const profileRoutes = require('./routes/profile.js');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(bodyparser.json());
app.use(morgan('dev'));
app.use(dbPool);
app.use(profileRoutes);

app.use((error, req, res, next) => {
  res.status(200).json({
    success: false,
    code: error.status,
    message: error.message
  });
})

app.listen(PORT, () => {
  console.log('Microservice: Profiles. Running on port:', PORT);
})