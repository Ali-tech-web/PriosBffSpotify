import express from 'express';
import axios from 'axios';
import  session from 'express-session'
import { stringify } from 'querystring';
import { config } from 'dotenv';


config();
const port = process.env.PORT || 3000;
const app = express();

app.use(session({
  secret: 'add-a-random-key-for-session',
  resave: false,
  saveUninitialized: true
}));

// TODO: We might need the clientId and token from user
//constants
const CLIENT_ID  =  process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI 
const AUTH_URL = process.env.AUTH_URL 
const TOKEN_URL = process.env.TOKEN_URL 
const API_BASE_URL = process.env.API_BASE_URL


app.use((err, req, res, next) => {
  if (err) {
    res.status(500).send('Internal Server Error');
  } else {
    next();
  }
});


app.get('/', (req, res) => {
  res.send("Welcome to my Spotify App <a href='/authenticate'> Login with Spotify </a>");
});

// spotify will use this route to access the spotify api using OAUTH
app.get('/authenticate', (req, res) => {
  const scope = 'user-read-private user-read-email'
  const params = {
    'client_id': CLIENT_ID,
    'response_type': 'code',
    'scope': scope,
    'redirect_uri': REDIRECT_URI,
    'show_dialog': true
  }
  const encodedParams = stringify(params);
  const auth_url = `${AUTH_URL}?${encodedParams}`
  return res.redirect(auth_url)
})

app.get('/callback', async (req, res) => {
  if (!req.query.code) {
    return res.status(400).send('Code parameter is missing');
  }
  if (req.query.code){
    try {
    const req_body = {
      'code': req.query.code,
      'grant_type': 'authorization_code',
      'redirect_uri': REDIRECT_URI,
      'client_id': CLIENT_ID,
      'client_secret': CLIENT_SECRET
    };
      const response = await axios.post(TOKEN_URL, req_body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const { access_token, refresh_token, expires_in } = response.data;
      session.access_token = access_token
      session.refresh_token = refresh_token
      session.expires_at =  new Date().getTime() + expires_in
      return res.redirect('/playlists')
    
    } catch (err) {
      res.status(500).send(`Error in making request to spotify api : ${err}`)
    }
  }
})

// Fetches all the playlists using access token, refresh token and session
app.get('/playlists', async (req, res) => {
  if (!session.access_token){
    return res.redirect('/authenticate')
  }
  if (new Date().getTime() > session['expires_at']){
    console.log('Print the token expired, refreshing')
    return res.redirect('/refresh-token')
  }

  try {
    const config = {
      method: 'GET',
      headers: {
        'Authorization' : `Bearer ${session.access_token}`,
      },
      url: API_BASE_URL + 'me/playlists'
    }
    const playlistResponse = await axios(config)
    return res.json(playlistResponse.data)

  } catch (err) {
    return res.status(500).send("Error in fetching playlist data")
  }
})

app.get('/refresh-token', async (req, res) => {
  if (!session.refresh_token){
    return res.redirect('/authenticate')
  }
  try {
    if (new Date().getTime() > session['expires_at']){
      console.log('About to refresh : ')
      const req_body = {
        'grant_type': 'refresh_token', 
        'refresh_token': session.refresh_token,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
      }
      const response = await axios.post(TOKEN_URL, req_body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      session.access_token = response.data.access_token
      session.expires_at =  new Date().getTime() +  response.data.expires_in
    
      return res.redirect('/playlists')
    }
  } catch(err) {
    res.status(500).send(`Error in refreshing the token ${err}`)

  }
})




// // Define a route for a different path
// app.get('/about', (req, res) => {
//   res.send('About page.');
// });

// // Define a route with dynamic content
// app.get('/user/:id', (req, res) => {
//   res.send(`User ID: ${req.params.id}`);
// });

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
