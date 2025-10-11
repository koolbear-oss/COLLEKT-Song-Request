# COLLEKT - DJ Song Request System

COLLEKT is a web application that allows DJs to create event-specific QR codes for song requests. Guests can scan these QR codes to submit song requests, which DJs can then manage through a real-time dashboard.

## Features

- **User Authentication**: Registration and login system for DJs
- **Event Management**: Create and manage events with unique QR codes
- **Song Request System**: Guests can submit song requests via a mobile-friendly form
- **DJ Dashboard**: Real-time management of song requests with drag-and-drop prioritization
- **Admin Panel**: Super admin functionality for user management

## Technology Stack

- HTML, CSS, JavaScript (Frontend)
- [Supabase](https://supabase.io/) (Backend as a Service)
- [SortableJS](https://github.com/SortableJS/Sortable) (Drag and drop functionality)
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) (QR code generation)

## Installation

1. Clone this repository
2. Deploy to a static web hosting service (Netlify, Vercel, etc.)
3. Set up Supabase tables as described in the Database Schema section

## Database Schema

### Tables

1. **events**
   - id (UUID, primary key)
   - name (text)
   - active (boolean)
   - created_at (timestamp)
   - created_by (text)

2. **requests**
   - id (UUID, primary key)
   - event_id (UUID, foreign key to events.id)
   - title (text)
   - artist (text)
   - message (text)
   - position (integer)
   - played (boolean)
   - played_at (timestamp)
   - created_at (timestamp)
   - is_starred (boolean)

3. **dj_users**
   - id (UUID, primary key)
   - auth_id (UUID, foreign key to auth.users.id)
   - name (text)
   - email (text)
   - active (boolean)
   - role_id (UUID, foreign key to roles.id)
   - subscription_ends (timestamp)
   - created_at (timestamp)

4. **roles**
   - id (UUID, primary key)
   - name (text)
   - created_at (timestamp)

## License

All rights reserved. This code is proprietary and confidential.

## Support

For support, contact [your support email].