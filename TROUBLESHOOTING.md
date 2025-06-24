# Video Call App - Peer Connection Troubleshooting Guide

## Overview

This guide helps diagnose and fix peer connection issues in the video call application. The app now includes enhanced monitoring and debugging features to help identify connection problems.

## Connection Status Indicators

The app displays real-time connection status with color-coded indicators:

- 🟢 **Green**: Connected successfully
- 🟡 **Yellow**: Connecting/checking
- 🔴 **Red**: Failed/error
- ⚪ **Gray**: Disconnected

## Common Issues and Solutions

### 1. ICE Connection Failed

**Symptoms:**
- Status shows "ICE failed"
- No video/audio received
- Console shows "ICE: Connection failed"

**Possible Causes:**
- Firewall blocking STUN servers
- Network restrictions
- NAT traversal issues

**Solutions:**
- Check if you're behind a corporate firewall
- Try from a different network (mobile hotspot)
- Ensure ports 3478 (STUN) are not blocked
- Add TURN servers for better connectivity

### 2. Peer Connection Failed

**Symptoms:**
- Status shows "peer failed"
- Call ends immediately after starting
- Console shows "Peer connection failed"

**Possible Causes:**
- Signaling issues
- Offer/answer exchange problems
- Media stream issues

**Solutions:**
- Check browser console for specific errors
- Ensure both users have camera/microphone permissions
- Try refreshing both browser windows
- Check if local stream is available

### 3. No Remote Video/Audio

**Symptoms:**
- Local video works but remote doesn't
- Status shows connected but no media
- Console shows "Received remote stream" but no video

**Possible Causes:**
- Remote user's camera/microphone disabled
- Track not properly added to peer connection
- Browser compatibility issues

**Solutions:**
- Ask remote user to check camera/microphone permissions
- Use the Debug Info button to check track status
- Try different browsers (Chrome, Firefox, Safari)
- Check if remote user has media devices

### 4. Signaling Issues

**Symptoms:**
- Call request sent but no response
- Answer received but connection not established
- ICE candidates not exchanged

**Possible Causes:**
- Socket.IO connection issues
- Server not forwarding messages
- User disconnected during signaling

**Solutions:**
- Check socket connection status
- Ensure both users are online
- Check server logs for message forwarding
- Try reconnecting both users

## Debugging Steps

### Step 1: Check Connection Status
1. Look at the connection status indicator at the top
2. Note the current state and any error messages
3. Check if status changes during call attempts

### Step 2: Use Debug Info Button
1. Click the "Debug Info" button in the header
2. Check browser console for detailed information
3. Look for:
   - Socket connection status
   - Local stream availability
   - Peer connection states
   - Track information

### Step 3: Monitor Console Logs
Watch for these key log messages:

**Successful Connection:**
```
ICE: Checking for connection...
ICE: Connected successfully!
Peer connection established!
Received remote stream
```

**Failed Connection:**
```
ICE: Connection failed
Peer connection failed
Error setting remote description
```

### Step 4: Check Network Conditions
1. Test with different networks
2. Try from different devices
3. Check if behind VPN/proxy
4. Test with different browsers

## Browser-Specific Issues

### Chrome
- Most reliable for WebRTC
- Check chrome://webrtc-internals/ for detailed logs
- Ensure HTTPS in production

### Firefox
- Good WebRTC support
- Check about:webrtc for connection info
- May have different ICE behavior

### Safari
- Limited WebRTC support
- May require TURN servers
- Check Safari Technology Preview for better support

## Server-Side Issues

### Socket.IO Connection
- Check if server is running
- Verify CORS settings
- Check for connection errors in server logs

### Message Forwarding
- Ensure server forwards all signaling messages
- Check user registration
- Verify socket room management

## Advanced Troubleshooting

### Adding TURN Servers
For better connectivity, add TURN servers to the ICE configuration:

```javascript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'username',
    credential: 'password'
  }
]
```

### Network Diagnostics
1. Check if STUN servers are reachable
2. Test UDP connectivity
3. Check for symmetric NAT
4. Verify firewall settings

### Media Stream Issues
1. Check getUserMedia permissions
2. Verify camera/microphone availability
3. Test with different media constraints
4. Check for hardware issues

## Getting Help

If you're still experiencing issues:

1. **Collect Debug Information:**
   - Click Debug Info button
   - Copy console logs
   - Note connection status changes
   - Record error messages

2. **Environment Details:**
   - Browser and version
   - Operating system
   - Network type (home/office/mobile)
   - Whether behind VPN/proxy

3. **Steps to Reproduce:**
   - Exact sequence of actions
   - When the issue occurs
   - Whether it's consistent or intermittent

## Prevention Tips

1. **Use HTTPS in Production:**
   - Required for camera/microphone access
   - Better WebRTC support

2. **Test on Different Networks:**
   - Home, office, mobile networks
   - Different ISPs if possible

3. **Keep Browsers Updated:**
   - Latest versions have better WebRTC support
   - Security updates improve connectivity

4. **Monitor Connection Quality:**
   - Use the status indicators
   - Check for connection drops
   - Implement reconnection logic

## Performance Optimization

1. **Reduce Video Quality:**
   - Lower resolution for better performance
   - Adjust frame rate if needed

2. **Optimize Audio:**
   - Use appropriate audio codecs
   - Consider echo cancellation

3. **Network Optimization:**
   - Use appropriate bitrates
   - Implement adaptive quality
   - Monitor bandwidth usage 