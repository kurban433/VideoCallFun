const socket = io();
let localStream;
let peerConnection;
let currentCall = null;
let isMuted = false;
let isVideoOff = false;

async function registerUser() {
  const nameInput = document.getElementById('nameInput');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter your name');
    return;
  }

  socket.emit('register-user', name);
  document.getElementById('nameForm').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
    alert('Error accessing camera and microphone');
  }
}

function toggleMute() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    isMuted = !isMuted;
    document.getElementById('muteButton').textContent = isMuted ? '🔇' : '🔊';
  }
}

function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    isVideoOff = !isVideoOff;
    document.getElementById('videoButton').textContent = isVideoOff ? '📷' : '📹';
  }
}

socket.on('user-list', (users) => {
  const userList = document.getElementById('userList');
  userList.innerHTML = '';

  users.forEach(user => {
    if (user.id !== socket.id) {
      const li = document.createElement('li');
      li.innerHTML = `
        ${user.name}
        <button onclick="startCall('${user.id}')">Call</button>
      `;
      userList.appendChild(li);
    }
  });
});

async function startCall(userId) {
  if (currentCall == userId) {
    alert('You are already calling this user');
    return;
  }

  if (currentCall) {
    alert('Please end current call first');
    return;
  }

  currentCall = userId;
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        to: userId,
        candidate: event.candidate
      });
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('call-user', {
    to: userId,
    offer: offer
  });

  document.getElementById('videoContainer').style.display = 'block';
}

socket.on('call-made', async ({ from, fromName, offer }) => {
  if (confirm(`${fromName} is calling you. Accept?`)) {
    currentCall = from;
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: from,
          candidate: event.candidate
        });
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('make-answer', {
      to: from,
      answer: answer
    });

    document.getElementById('videoContainer').style.display = 'block';
  }
});

socket.on('answer-made', async ({ from, answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ from, candidate }) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
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
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('videoContainer').style.display = 'none';
}

socket.on('call-ended', () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  currentCall = null;
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('videoContainer').style.display = 'none';
});

function swapVideos() {
  const videoContainer = document.getElementById('videoContainer');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');

  videoContainer.classList.toggle('video-swapped');

  if (videoContainer.classList.contains('video-swapped')) {
    localVideo.style.zIndex = '2';
    remoteVideo.style.zIndex = '1';
    remoteVideo.style.cursor = 'pointer';
    localVideo.onclick = null;
    remoteVideo.onclick = swapVideos;
  } else {
    localVideo.style.zIndex = '2';
    remoteVideo.style.zIndex = '1';
    remoteVideo.style.cursor = 'default';
    remoteVideo.onclick = null;
    localVideo.onclick = swapVideos;
  }
} 