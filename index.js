// import Video from './components/video.js';

const APP_ID = 'aac84fe5dca84378b98dc9fe0f9062c3';
const token = null;
const uid = crypto.randomUUID();

let client;
let channel;

const queryString = new URLSearchParams(window.location?.search);
const roomId = queryString.get('room');

let localStream;
let remoteStream;
let peerConnection;

let userTwoScreen;

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

if (!roomId) window.location = 'lobby.html';

const init = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  // const video = new Video(localStream);
  // console.log(video);
  // document.querySelector('.chat-container').appendChild(video.render());
  document.getElementById('user-1').srcObject = localStream;

  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  // index.html?room=234234

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on('MemberJoined', handleUserJoined);
  channel.on('MemberLeft', handleUserLeft);

  client.on('MessageFromPeer', handleMessageFromPeer);
};

function handleMessageFromPeer(message, memberId) {
  message = JSON.parse(message.text);

  message.type === 'offer' && createAnswer(memberId, message.offer);

  message.type === 'answer' && addAnswer(message.answer);

  message.type === 'candidate' &&
    peerConnection.addIceCandidate(message.candidate);
}

async function handleUserJoined(memberId) {
  console.log('A new user joined the channel => ', memberId);
  await createOffer(memberId);
}

function handleUserLeft(memberId) {
  console.log(memberId);
  document.getElementById('user-2').style.display = 'none';
}

const createPeerConnection = async (memberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  userTwoScreen = document.getElementById('user-2');
  userTwoScreen.srcObject = remoteStream;
  userTwoScreen.style.display = 'block';

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    event.candidate &&
      (await client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: 'candidate',
            candidate: event.candidate,
          }),
        },
        memberId
      ));
  };
};

async function createOffer(memberId) {
  await createPeerConnection(memberId);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: 'offer', offer }) },
    memberId
  );
}

async function createAnswer(memberId, offer) {
  await createPeerConnection(memberId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  console.log(answer);
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: 'answer', answer }) },
    memberId
  );
}

async function addAnswer(answer) {
  if (!peerConnection.currentRemoteDescription) {
    console.log('ADD ANSWER => ', answer, peerConnection);
    await peerConnection.setRemoteDescription(answer);
  }
}

const leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

async function toggleCamera() {
  const videoTrack = await localStream
    .getTracks()
    .find((track) => track.kind === 'video');

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.querySelector('.camera').style.backgroundColor =
      'rgb(227, 87, 87)';
  } else {
    videoTrack.enabled = true;
    document.querySelector('.camera').style.backgroundColor =
      'rgb(216, 224, 232)';
  }
}

async function toggleMic() {
  const audioTrack = await localStream
    .getTracks()
    .find((track) => track.kind === 'audio');

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.querySelector('.mic').style.backgroundColor = 'rgb(227, 87, 87)';
  } else {
    audioTrack.enabled = true;
    document.querySelector('.mic').style.backgroundColor = 'rgb(216, 224, 232)';
  }
}

window.addEventListener('beforeunload', leaveChannel);

document.querySelector('.camera').addEventListener('click', toggleCamera);
document.querySelector('.mic').addEventListener('click', toggleMic);

init();
