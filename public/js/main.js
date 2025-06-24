// Detect environment and set up Socket.IO connection
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname === '';

const socket = isLocalhost 
  ? io() 
  : io(window.location.origin, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });

let localStream;
let peerConnection;
let currentCall = null;
let isMuted = false;
let isVideoOff = false;
let currentUserName = '';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  // Add enter key support for name input
  document.getElementById('nameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      registerUser();
    }
  });
});

// Socket connection status
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

async function registerUser() {
  const nameInput = document.getElementById('nameInput');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter your name');
    return;
  }

  console.log('Registering user:', name);
  currentUserName = name;
  
  // Show main screen
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  
  // Update current user name display
  document.getElementById('currentUserName').textContent = `Welcome, ${name}`;

  // Register with server
  socket.emit('register-user', name);

  // Get user media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    document.getElementById('localVideo').srcObject = localStream;
    console.log('Media stream obtained successfully');
  } catch (err) {
    console.error('Error accessing media devices:', err);
    alert('Error accessing camera and microphone. Please check permissions.');
  }
}

function disconnect() {
  if (currentCall) {
    endCall();
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  socket.disconnect();
  
  // Reset UI
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('welcomeScreen').classList.remove('hidden');
  document.getElementById('nameInput').value = '';
  
  // Reset variables
  currentUserName = '';
  localStream = null;
  peerConnection = null;
  currentCall = null;
  isMuted = false;
  isVideoOff = false;
}

function toggleMute() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !isMuted;
      
      const muteButton = document.getElementById('muteButton');
      muteButton.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
      muteButton.querySelector('.label').textContent = isMuted ? 'Unmute' : 'Mute';
    }
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoOff = !isVideoOff;
      
      const videoButton = document.getElementById('videoButton');
      videoButton.querySelector('.icon').textContent = isVideoOff ? '📷' : '📹';
      videoButton.querySelector('.label').textContent = isVideoOff ? 'Show Video' : 'Hide Video';
    }
  }
}

// Socket event listeners
socket.on('user-list', (users) => {
  console.log('Received user list:', users);
  const userList = document.getElementById('userList');
  userList.innerHTML = '';

  users.forEach(user => {
    if (user.id !== socket.id) {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.innerHTML = `
        <div>
          <div class="user-name">${user.name}</div>
          <div class="status">${user.status}</div>
        </div>
        <button class="call-btn" onclick="startCall('${user.id}', '${user.name}')" ${currentCall ? 'disabled' : ''}>
          Call
        </button>
      `;
      userList.appendChild(userItem);
      console.log(`Added user item for: ${user.name} (${user.id})`);
    }
  });
});

async function startCall(userId, userName) {
  console.log(`startCall called with userId: ${userId}, userName: ${userName}`);
  
  if (currentCall) {
    console.log('Already in a call, cannot start new call');
    alert('Please end current call first');
    return;
  }

  if (!localStream) {
    console.log('No local stream available');
    alert('Camera and microphone access is required for calls');
    return;
  }

  console.log(`Starting call to ${userName} (${userId})`);
  currentCall = userId;
  
  // Create peer connection
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  // Add local stream tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle incoming remote stream
  peerConnection.ontrack = (event) => {
    console.log('Received remote stream');
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate');
      socket.emit('ice-candidate', {
        to: userId,
        candidate: event.candidate
      });
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed' || 
        peerConnection.connectionState === 'disconnected') {
      endCall();
    }
  };

  try {
    // Create and send offer
    console.log('Creating offer...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    console.log('Sending call request to server');
    socket.emit('call-user', {
      to: userId,
      offer: offer
    });

    // Show video container
    showVideoContainer();
    
    console.log(`Calling ${userName}...`);
  } catch (error) {
    console.error('Error creating offer:', error);
    alert('Failed to start call');
    endCall();
  }
}

socket.on('call-made', async ({ from, fromName, offer }) => {
  console.log('Received call-made event:', { from, fromName, offer },currentCall);
  if (currentCall) {
    // Already in a call, reject
    socket.emit('call-ended', { to: from });
    return;
  }

  if (confirm(`${fromName} is calling you. Accept?`)) {
    currentCall = from;
    
    // Create peer connection
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: from,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'disconnected') {
        endCall();
      }
    };

    try {
      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('make-answer', {
        to: from,
        answer: answer
      });

      // Show video container
      showVideoContainer();
      
      console.log(`Call with ${fromName} started`);
    } catch (error) {
      console.error('Error handling incoming call:', error);
      alert('Failed to accept call');
      endCall();
    }
  } else {
    // Reject call
    socket.emit('call-ended', { to: from });
  }
});

socket.on('answer-made', async ({ from, answer }) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Call answered');
  } catch (error) {
    console.error('Error setting remote description:', error);
  }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  if (peerConnection && peerConnection.remoteDescription) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
});

socket.on('call-ended', ({ from }) => {
  console.log('Call ended by remote user');
  endCall();
});

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (currentCall) {
    socket.emit('call-ended', { to: currentCall });
    currentCall = null;
  }
  
  // Clear remote video
  document.getElementById('remoteVideo').srcObject = null;
  
  // Hide video container
  hideVideoContainer();
  
  console.log('Call ended');
}

function showVideoContainer() {
  document.getElementById('videoContainer').classList.remove('hidden');
  document.getElementById('noCallMessage').classList.add('hidden');
}

function hideVideoContainer() {
  document.getElementById('videoContainer').classList.add('hidden');
  document.getElementById('noCallMessage').classList.remove('hidden');
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (currentCall) {
    socket.emit('call-ended', { to: currentCall });
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
}); 