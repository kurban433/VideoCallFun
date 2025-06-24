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
let connectionStatus = 'disconnected';

// Connection status display
function updateConnectionStatus(status, details = '') {
  connectionStatus = status;
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
    statusElement.textContent = `Connection: ${status} ${details}`;
    statusElement.className = `status-${status}`;
  }
  console.log(`Connection status: ${status} ${details}`);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  // Add enter key support for name input
  document.getElementById('nameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      registerUser();
    }
  });
  
  // Add connection status display
  const mainScreen = document.getElementById('mainScreen');
  if (mainScreen && !document.getElementById('connectionStatus')) {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connectionStatus';
    statusDiv.className = 'connection-status';
    statusDiv.textContent = 'Connection: disconnected';
    mainScreen.insertBefore(statusDiv, mainScreen.firstChild);
  }
});

// Socket connection status
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  updateConnectionStatus('connected', `(ID: ${socket.id})`);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  updateConnectionStatus('disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  updateConnectionStatus('error', `(${error.message})`);
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

  // Add debug button
  addDebugButton();

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
  
  // Create peer connection with enhanced configuration
  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  });

  // Enhanced connection monitoring
  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE Connection State:', peerConnection.iceConnectionState);
    updateConnectionStatus('ice-' + peerConnection.iceConnectionState);
    
    switch (peerConnection.iceConnectionState) {
      case 'checking':
        console.log('ICE: Checking for connection...');
        break;
      case 'connected':
        console.log('ICE: Connected successfully!');
        updateConnectionStatus('connected', '(ICE connected)');
        break;
      case 'completed':
        console.log('ICE: Connection completed');
        updateConnectionStatus('connected', '(ICE completed)');
        break;
      case 'failed':
        console.error('ICE: Connection failed');
        updateConnectionStatus('failed', '(ICE failed)');
        alert('Connection failed. Please try again.');
        endCall();
        break;
      case 'disconnected':
        console.warn('ICE: Connection disconnected');
        updateConnectionStatus('disconnected', '(ICE disconnected)');
        break;
      case 'closed':
        console.log('ICE: Connection closed');
        updateConnectionStatus('disconnected', '(ICE closed)');
        break;
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log('ICE Gathering State:', peerConnection.iceGatheringState);
  };

  peerConnection.onsignalingstatechange = () => {
    console.log('Signaling State:', peerConnection.signalingState);
  };

  // Add local stream tracks
  localStream.getTracks().forEach(track => {
    console.log('Adding track to peer connection:', track.kind);
    peerConnection.addTrack(track, localStream);
  });

  // Handle incoming remote stream
  peerConnection.ontrack = (event) => {
    console.log('Received remote stream:', event.streams[0]);
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    updateConnectionStatus('connected', '(stream received)');
  };

  // Handle ICE candidates with enhanced logging
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate:', event.candidate.type, event.candidate.protocol);
      socket.emit('ice-candidate', {
        to: userId,
        candidate: event.candidate
      });
    } else {
      console.log('ICE candidate gathering completed');
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    updateConnectionStatus('peer-' + peerConnection.connectionState);
    
    switch (peerConnection.connectionState) {
      case 'new':
        console.log('Peer connection created');
        break;
      case 'connecting':
        console.log('Peer connection connecting...');
        break;
      case 'connected':
        console.log('Peer connection established!');
        updateConnectionStatus('connected', '(peer connected)');
        break;
      case 'disconnected':
        console.warn('Peer connection disconnected');
        updateConnectionStatus('disconnected', '(peer disconnected)');
        break;
      case 'failed':
        console.error('Peer connection failed');
        updateConnectionStatus('failed', '(peer failed)');
        alert('Peer connection failed. Please try again.');
        endCall();
        break;
      case 'closed':
        console.log('Peer connection closed');
        updateConnectionStatus('disconnected', '(peer closed)');
        break;
    }
  };

  try {
    // Create and send offer
    console.log('Creating offer...');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);

    console.log('Sending call request to server');
    socket.emit('call-user', {
      to: userId,
      offer: offer
    });

    // Show video container
    showVideoContainer();
    
    console.log(`Calling ${userName}...`);
    updateConnectionStatus('connecting', '(sending offer)');
  } catch (error) {
    console.error('Error creating offer:', error);
    alert('Failed to start call: ' + error.message);
    endCall();
  }
}

socket.on('call-made', async ({ from, fromName, offer }) => {
  console.log('Received call-made event:', { from, fromName, offer }, currentCall);
  if (currentCall) {
    // Already in a call, reject
    socket.emit('call-ended', { to: from });
    return;
  }

  if (confirm(`${fromName} is calling you. Accept?`)) {
    currentCall = from;
    
    // Create peer connection with enhanced configuration
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    });

    // Enhanced connection monitoring for incoming calls
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE Connection State (incoming):', peerConnection.iceConnectionState);
      updateConnectionStatus('ice-' + peerConnection.iceConnectionState);
      
      switch (peerConnection.iceConnectionState) {
        case 'checking':
          console.log('ICE: Checking for connection...');
          break;
        case 'connected':
          console.log('ICE: Connected successfully!');
          updateConnectionStatus('connected', '(ICE connected)');
          break;
        case 'completed':
          console.log('ICE: Connection completed');
          updateConnectionStatus('connected', '(ICE completed)');
          break;
        case 'failed':
          console.error('ICE: Connection failed');
          updateConnectionStatus('failed', '(ICE failed)');
          alert('Connection failed. Please try again.');
          endCall();
          break;
        case 'disconnected':
          console.warn('ICE: Connection disconnected');
          updateConnectionStatus('disconnected', '(ICE disconnected)');
          break;
        case 'closed':
          console.log('ICE: Connection closed');
          updateConnectionStatus('disconnected', '(ICE closed)');
          break;
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE Gathering State (incoming):', peerConnection.iceGatheringState);
    };

    peerConnection.onsignalingstatechange = () => {
      console.log('Signaling State (incoming):', peerConnection.signalingState);
    };

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      console.log('Adding track to peer connection (incoming):', track.kind);
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream (incoming):', event.streams[0]);
      document.getElementById('remoteVideo').srcObject = event.streams[0];
      updateConnectionStatus('connected', '(stream received)');
    };

    // Handle ICE candidates with enhanced logging
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate (incoming):', event.candidate.type, event.candidate.protocol);
        socket.emit('ice-candidate', {
          to: from,
          candidate: event.candidate
        });
      } else {
        console.log('ICE candidate gathering completed (incoming)');
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state (incoming):', peerConnection.connectionState);
      updateConnectionStatus('peer-' + peerConnection.connectionState);
      
      switch (peerConnection.connectionState) {
        case 'new':
          console.log('Peer connection created (incoming)');
          break;
        case 'connecting':
          console.log('Peer connection connecting... (incoming)');
          break;
        case 'connected':
          console.log('Peer connection established! (incoming)');
          updateConnectionStatus('connected', '(peer connected)');
          break;
        case 'disconnected':
          console.warn('Peer connection disconnected (incoming)');
          updateConnectionStatus('disconnected', '(peer disconnected)');
          break;
        case 'failed':
          console.error('Peer connection failed (incoming)');
          updateConnectionStatus('failed', '(peer failed)');
          alert('Peer connection failed. Please try again.');
          endCall();
          break;
        case 'closed':
          console.log('Peer connection closed (incoming)');
          updateConnectionStatus('disconnected', '(peer closed)');
          break;
      }
    };

    try {
      // Set remote description and create answer
      console.log('Setting remote description...');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      console.log('Creating answer...');
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(answer);

      console.log('Sending answer to caller...');
      socket.emit('make-answer', {
        to: from,
        answer: answer
      });

      // Show video container
      showVideoContainer();
      
      console.log(`Call with ${fromName} started`);
      updateConnectionStatus('connecting', '(answering call)');
    } catch (error) {
      console.error('Error handling incoming call:', error);
      alert('Failed to accept call: ' + error.message);
      endCall();
    }
  } else {
    // Reject call
    socket.emit('call-ended', { to: from });
  }
});

socket.on('answer-made', async ({ from, answer }) => {
  console.log('Received answer from:', from);
  try {
    if (!peerConnection) {
      console.error('No peer connection available for answer');
      return;
    }
    
    if (peerConnection.signalingState !== 'have-local-offer') {
      console.warn('Unexpected signaling state for answer:', peerConnection.signalingState);
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Remote description set successfully');
    updateConnectionStatus('connecting', '(answer received)');
    
    // Handle any pending ICE candidates
    await handlePendingCandidates();
  } catch (error) {
    console.error('Error setting remote description:', error);
    alert('Failed to establish connection: ' + error.message);
    endCall();
  }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  console.log('Received ICE candidate from:', from, 'Type:', candidate.type);
  
  if (!peerConnection) {
    console.warn('No peer connection available for ICE candidate');
    return;
  }
  
  if (!peerConnection.remoteDescription) {
    console.warn('No remote description set, storing candidate for later');
    // Store candidate to add later when remote description is set
    if (!peerConnection.pendingCandidates) {
      peerConnection.pendingCandidates = [];
    }
    peerConnection.pendingCandidates.push(candidate);
    return;
  }
  
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('ICE candidate added successfully');
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
    // Don't end call for ICE candidate errors, they're often non-fatal
  }
});

socket.on('call-ended', ({ from }) => {
  console.log('Call ended by remote user');
  endCall();
});

// Function to handle pending ICE candidates
async function handlePendingCandidates() {
  if (peerConnection && peerConnection.pendingCandidates && peerConnection.pendingCandidates.length > 0) {
    console.log('Processing pending ICE candidates:', peerConnection.pendingCandidates.length);
    for (const candidate of peerConnection.pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Pending ICE candidate added successfully');
      } catch (error) {
        console.error('Error adding pending ICE candidate:', error);
      }
    }
    peerConnection.pendingCandidates = [];
  }
}

function endCall() {
  console.log('Ending call...');
  
  if (peerConnection) {
    // Log final connection states before closing
    console.log('Final connection states:');
    console.log('- ICE Connection State:', peerConnection.iceConnectionState);
    console.log('- Connection State:', peerConnection.connectionState);
    console.log('- Signaling State:', peerConnection.signalingState);
    
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
  
  // Reset connection status
  updateConnectionStatus('disconnected', '(call ended)');
  
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

// Debug function to log comprehensive connection information
function logConnectionDebug() {
  console.log('=== CONNECTION DEBUG INFO ===');
  console.log('Socket connected:', socket.connected);
  console.log('Socket ID:', socket.id);
  console.log('Current call:', currentCall);
  console.log('Local stream:', localStream ? 'Available' : 'Not available');
  
  if (localStream) {
    const tracks = localStream.getTracks();
    console.log('Local stream tracks:', tracks.length);
    tracks.forEach(track => {
      console.log(`- ${track.kind}: ${track.enabled ? 'enabled' : 'disabled'}`);
    });
  }
  
  if (peerConnection) {
    console.log('Peer connection exists');
    console.log('- ICE Connection State:', peerConnection.iceConnectionState);
    console.log('- Connection State:', peerConnection.connectionState);
    console.log('- Signaling State:', peerConnection.signalingState);
    console.log('- ICE Gathering State:', peerConnection.iceGatheringState);
    
    const senders = peerConnection.getSenders();
    const receivers = peerConnection.getReceivers();
    console.log('- Senders:', senders.length);
    console.log('- Receivers:', receivers.length);
    
    senders.forEach(sender => {
      if (sender.track) {
        console.log(`  - Sender track: ${sender.track.kind} (${sender.track.enabled ? 'enabled' : 'disabled'})`);
      }
    });
    
    receivers.forEach(receiver => {
      if (receiver.track) {
        console.log(`  - Receiver track: ${receiver.track.kind} (${receiver.track.enabled ? 'enabled' : 'disabled'})`);
      }
    });
  } else {
    console.log('No peer connection');
  }
  
  console.log('Remote video srcObject:', document.getElementById('remoteVideo').srcObject ? 'Set' : 'Not set');
  console.log('Local video srcObject:', document.getElementById('localVideo').srcObject ? 'Set' : 'Not set');
  console.log('=== END DEBUG INFO ===');
}

// Add debug button to UI
function addDebugButton() {
  const header = document.querySelector('.header');
  if (header && !document.getElementById('debugButton')) {
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debugButton';
    debugBtn.className = 'btn-secondary';
    debugBtn.textContent = 'Debug Info';
    debugBtn.onclick = logConnectionDebug;
    debugBtn.style.marginLeft = '10px';
    header.appendChild(debugBtn);
  }
} 