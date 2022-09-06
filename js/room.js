import { app_ID } from "./env.js";
let messageContainer = document.getElementById("messages");
messageContainer.scrollTop = messageContainer.scrollHeight;
let appID = app_ID;
let token = null;
let uid = sessionStorage.getItem('rtmUID');
if (uid === null || uid === undefined) {
    uid = String(Math.floor(Math.random() * 232));
    sessionStorage.setItem('rtmUID', uid);
};
let urlParams = new URLSearchParams(window.location.search);
let room = urlParams.get("room");
let host;
let hostId;
let displayName = sessionStorage.getItem('display_name');

if (room === null || displayName === null) {
    window.location = `join.html?room=${room}`;
};
let initiate = async() => {
    let rtmClient = await AgoraRTM.createInstance(appID);
    await rtmClient.login({
        uid,
        token
    });
    try {

        let attributes = await rtmClient.getChannelAttributesByKeys(room, ['host_id']);
        hostId = attributes.host_id.value;
        if (uid === hostId) {
            host = true;
            document.getElementById('stream_controls').style.display = "flex"
        }

    } catch (error) {
        await rtmClient.setChannelAttributes(room, {
            'host': displayName,
            'host_id': uid

        })
        host = true;
        document.getElementById('stream_controls').style.display = 'flex'




    };

    const channel = await rtmClient.createChannel(room);
    await channel.join();

    await rtmClient.addOrUpdateLocalUserAttributes({
        'name': displayName
    });

    channel.on("MemberLeft", async(memberId) => {
        removeParticipantFromDom(memberId);

        let participants = await channel.getMembers();
        updateParticipantTotal(participants);

    });
    channel.on("MemberJoined", async(memberId) => {
        addParticipantToDom(memberId);

        let participants = await channel.getMembers();
        updateParticipantTotal(participants);
    });

    channel.on('ChannelMessage', async(messageData, memberId) => {
        let data = JSON.parse(messageData.text);
        let name = data.displayName;

        addMessageToDom(data.message, memberId, name);

        let participants = await channel.getMembers();
        updateParticipantTotal(participants);


    });
    let addParticipantToDom = async(memberId) => {

        let { name } = await rtmClient.getUserAttributesByKeys(memberId, ['name']);
        let membersWrapper = document.getElementById("participants_container");
        let memberItem = `<div id ='member_${memberId}_wrapper' class="member_wrapper"> <span class="green_dot"> </span> <p>${name}</p> </div>`;

        membersWrapper.innerHTML += memberItem;
    };


    let addMessageToDom = (messageData, memberId, displayName) => {
        let created = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (created.startsWith("0")) {
            created = created.substring(1)
        }
        let messageWrapper = document.getElementById("messages");
        let messageItem = '<div class="message_wrapper"><small>' + created + '</small> <p>' + displayName + '</p> <p class= "message">' + messageData + '</p> </div>';
        messageWrapper.insertAdjacentHTML("beforeend", messageItem);

        let lastMessage = document.querySelector('#messages .message_wrapper:last-child');
        lastMessage.scrollIntoView();

    };
    let sendMessage = async(e) => {
        e.preventDefault();
        let message = e.target.message.value
        channel.sendMessage({ text: JSON.stringify({ "message": message, 'displayName': displayName }) });
        addMessageToDom(message, uid, displayName);
        e.target.reset();

    };
    let updateParticipantTotal = (participants) => {
        let total = document.getElementById('member_count');
        total.innerText = participants.length;

    };
    let getParticipants = async() => {
        let participants = await channel.getMembers();
        updateParticipantTotal(participants)
        for (let i = 0; i < participants.length; i++) {
            addParticipantToDom(participants[i]);

        }
    };
    let removeParticipantFromDom = (memberId) => {
        document.getElementById(`member_${memberId}_wrapper`).remove();

    };
    let leaveChannel = async() => {
        await channel.leave()
        await rtmClient.logout()
    };
    window.addEventListener("beforeunload", leaveChannel);
    getParticipants();
    let messageForm = document.getElementById("message_form");
    messageForm.addEventListener("submit", sendMessage)
};

//RTC config

let rtcUid = Math.floor(Math.random() * 232);

let config = {
    appId: app_ID,
    token: null,
    uid: rtcUid,
    channel: room,



}
let localTracks = [];
let localScreenTracks;

let rtcClient = AgoraRTC.createClient({
    mode: 'live',
    codec: 'vp8'
});

let streaming = false;
let sharingScreen = false;

let initiateRtc = async() => {
    await rtcClient.join(config.appId, config.channel, config.token, config.uid);
    rtcClient.on('user-published', handleUserPublished);
    rtcClient.on('user-unpublished', handleUserLeft)

};
//class="active"
let toggleStream = async() => {
    if (!streaming) {

        streaming = true;

        toggleVideoShare();
        document.getElementById("stream-btn").innerText = 'Stop';

    } else {
        streaming = false;
        document.getElementById("stream-btn").innerText = 'Start';

        for (let i = 0; localTracks.length > i; i++) {
            localTracks[i].stop();
            localTracks[i].close();
        }

    }
    await rtcClient.unpublish([localTracks[0], localTracks[1]]);

}
let toggleVideoShare = async() => {
    rtcClient.setClientRole('host');

    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
    document.getElementById('video_call').innerHTML = '';

    let player = `<div class="video-container" id ="user-container-${rtcUid}"> <div class="video-player" id="user-${rtcUid}"></div>
</div>`;
    document.getElementById('video_call').insertAdjacentHTML('beforeend', player);
    localTracks[1].play(`user-${rtcUid}`);
    await rtcClient.publish([localTracks[0], localTracks[1]]);
}
let handleUserPublished = async(user, mediaType) => {
    await rtcClient.subscribe(user, mediaType);
    if (mediaType === 'video') {
        document.getElementById('video_call').innerHTML = '';
        let player = document.getElementById(`user-container-${user.uid}`);
        if (player != null) {
            player.remove();

        }
        player = `<div class="video-container" id ="user-container-${user.uid}"> <div class="video-player" id="user-${user.uid}"></div></div>`;
        document.getElementById('video_call').insertAdjacentHTML('beforeend', player);
        user.videoTrack.play(`user-${user.uid}`);

    }
    if (mediaType = 'audio') {
        user.audioTrack.play()

    }
}
let handleUserLeft = async(user) => {
    document.getElementById(`video_call`).innerHTML = '';
}
let toggleCamera = async(e) => {
    if (localTracks[1].muted) {
        localTracks[1].setMuted(false);
        e.target.classLists.add('active');
    } else {

        localTracks[1].setMuted(true);
        e.target.classLists.remove('active');
    }

}
let toggleMic = async(e) => {
    if (localTracks[0].muted) {
        localTracks[0].setMuted(false);
        e.target.classLists.add('active');
    } else {

        localTracks[0].setMuted(true);
        e.target.classLists.remove('active');
    }

}
let toggleScreenShare = async() => {
    if (sharingScreen) {

        sharingScreen = false;
        await rtcClient.unpublish([localScreenTracks])
        toggleVideoShare();

    } else {
        sharingScreen = true;

        localScreenTracks = await AgoraRTC.createScreenVideoTrack();
        document.getElementById('video_call').innerHTML = '';
        let player = document.getElementById(`user-container-${rtcUid}`);
        if (player != null) {
            player.remove();

        }
        player = `<div class="video-container" id ="user-container-${rtcUid}"> <div class="video-player" id="user-${rtcUid}"></div></div>`;

        document.getElementById('video_call').insertAdjacentHTML('beforeend', player);
        localScreenTracks.play(`user-${rtcUid}`);
        await rtcClient.unpublish([localTracks[0], localTracks[1]]);
        await rtcClient.publish([localScreenTracks]);
    }

}
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
document.getElementById('screen-btn').addEventListener('click', toggleScreenShare);
document.getElementById("stream-btn").addEventListener("click",
    toggleStream);

initiate();
initiateRtc();