const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Your routes and middleware go here


app.get('/', (req, res) => {
    res.send('Hello, this is your Express server!');
  });
  
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
