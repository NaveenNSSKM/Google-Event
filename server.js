const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const calendarPkg = require('@googleapis/calendar');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Load static Meeting link from environment or default
const MEETING_LINK = process.env.MEETING_LINK || 'https://meet.google.com/nrf-hvza-oqw';

// API Endpoint to handle registration and send invite
app.post('/api/register', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required.'
    });
  }

  try {
    // Initialize the OAuth2 client using the backend's credentials
    const oauth2Client = new calendarPkg.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    // Set the refresh token
    oauth2Client.setCredentials({ 
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN 
    });

    // Initialize Calendar service
    const calendar = calendarPkg.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    // Define the event (adjust title/times as needed)
    const event = {
      summary: 'FutureTech Summit 2026',
      location: MEETING_LINK,
      description: `Hi ${name},\n\nThank you for registering!\n\nHere is your static Google Meet link to join the sessions:\n${MEETING_LINK}\n\nSee you there!\n- Event Team`,
      start: {
        dateTime: '2026-11-24T10:00:00Z', // Nov 24, 2026, 10:00 AM UTC
        timeZone: 'UTC'
      },
      end: {
        dateTime: '2026-11-24T12:00:00Z', // Nov 24, 2026, 12:00 PM UTC
        timeZone: 'UTC'
      },
      // Invite the registrant as an attendee to trigger the automatic invite email
      attendees: [
        { email: email, displayName: name }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // Email 24 hours before
          { method: 'popup', minutes: 30 }       // Popup 30 minutes before
        ]
      }
    };

    console.log(`[Backend API] Creating calendar event and inviting attendee: ${email}`);

    // Create event on organizer's primary calendar and send updates to all attendees
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all' // Crucial: This instructs Google to automatically send the invitation email
    });

    console.log(`[Backend API Success] Event created successfully: ${response.data.htmlLink}`);

    return res.status(200).json({
      success: true,
      message: 'Registration successful! Google Calendar invite has been sent to your email.',
      eventLink: response.data.htmlLink
    });

  } catch (error) {
    console.error('[Backend API Error] Failed to create Google Calendar event:', error);
    
    const status = error.status || 500;
    const msg = error.errors?.[0]?.message || error.message || 'Failed to send calendar invite.';

    return res.status(status).json({
      success: false,
      message: `Google API Error: ${msg}. Make sure your token is valid and has calendar permissions.`
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});
