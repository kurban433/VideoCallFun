# Video Call App

A simple real-time video calling application built with Node.js, Socket.IO, and WebRTC.

## Features

- Real-time video calls between users
- User registration and online status
- Mute/unmute audio
- Enable/disable video
- Responsive design
- No database required (in-memory storage)

## Local Development

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd VideoCallFun
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Production Deployment

### Option 1: Heroku

1. Create a Heroku app:
```bash
heroku create your-video-call-app
```

2. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGIN=https://your-app-name.herokuapp.com
```

3. Deploy:
```bash
git push heroku main
```

### Option 2: Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard:
   - `NODE_ENV=production`
   - `ALLOWED_ORIGIN=https://your-app-name.railway.app`

### Option 3: VPS/Cloud Server

1. Install Node.js and PM2 on your server
2. Clone the repository
3. Install dependencies: `npm install`
4. Set environment variables:
```bash
export NODE_ENV=production
export ALLOWED_ORIGIN=https://yourdomain.com
```

5. Start with PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Option 4: Docker

1. Build the Docker image:
```bash
docker build -t video-call-app .
```

2. Run the container:
```bash
docker run -p 3000:3000 -e NODE_ENV=production -e ALLOWED_ORIGIN=https://yourdomain.com video-call-app
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `3000` | No |
| `ALLOWED_ORIGIN` | CORS allowed origin | `*` | No |

## Troubleshooting

### Connection Issues in Production

1. **CORS Errors**: Make sure `ALLOWED_ORIGIN` is set to your domain
2. **Socket.IO Connection**: The app automatically detects localhost vs production
3. **WebRTC Issues**: Check if your hosting provider supports WebRTC
4. **HTTPS Required**: Most browsers require HTTPS for camera/microphone access

### Common Issues

- **Camera/Microphone not working**: Ensure HTTPS is enabled in production
- **Users not connecting**: Check firewall settings and port configuration
- **Video quality issues**: Consider adding TURN servers for better connectivity

## WebRTC Configuration

The app uses Google's public STUN servers by default. For better connectivity in production, consider:

1. Adding TURN servers for users behind strict firewalls
2. Using a commercial WebRTC service like Twilio or Agora
3. Setting up your own TURN server

## Security Considerations

- The app currently allows all origins (`*`) in development
- In production, set `ALLOWED_ORIGIN` to your specific domain
- Consider implementing user authentication for production use
- WebRTC connections are peer-to-peer and encrypted

## License

ISC