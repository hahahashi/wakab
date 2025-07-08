"use strict";
const express = require("express");
const compression = require("compression");
let app = express();
const axios = require('axios');
const ytsr = require('ytsr');

const port = process.env.PORT || 3000;
const CHATWORK_API_TOKEN = process.env.CWapitoken;
const YOUTUBE_URL = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w\-]+)/;

app.use(express.json());
app.use(compression());
app.use(express.urlencoded({ extended: true }));

let apis = null;
const MAX_API_WAIT_TIME = 3000; 
const MAX_TIME = 10000;

async function getapis() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json');
        apis = await response.data;
        console.log('データを取得しました:', apis);
    } catch (error) {
        console.error('データの取得に失敗しました:', error);
        await getapisgit();
    }
}

async function getapisgit() {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/wakame02/wktopu/refs/heads/main/inv.json');
        apis = await response.data;
        console.log('データを取得しました:', apis);
    } catch (error) {
        console.error('データの取得に失敗しました:', error);
    }
}

async function ggvideo(videoId) {
  const startTime = Date.now();
  const instanceErrors = new Set();
  for (let i = 0; i < 20; i++) {
    if (Math.floor(Math.random() * 20) === 0) {
        await getapis();
    }
  }
  if(!apis){
    await getapisgit();
  }
  for (const instance of apis) {
    try {
      const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: MAX_API_WAIT_TIME });
      console.log(`使ってみたURL: ${instance}/api/v1/videos/${videoId}`);
      
      if (response.data && response.data.formatStreams) {
        return response.data; 
      } else {
        console.error(`formatStreamsが存在しない: ${instance}`);
      }
    } catch (error) {
      console.error(`エラーだよ: ${instance} - ${error.message}`);
      instanceErrors.add(instance);
    }

    if (Date.now() - startTime >= MAX_TIME) {
      throw new Error("接続がタイムアウトしました");
      break;
    }
  }
  throw new Error("動画を取得する方法が見つかりません");
}

async function getYouTube (videoId) {
  try {
    const videoInfo = await ggvideo(videoId);
    const formatStreams = videoInfo.formatStreams || [];
    let streamUrl = formatStreams.reverse().map(stream => stream.url)[0];
    const audioStreams = videoInfo.adaptiveFormats || [];
    let highstreamUrl = audioStreams
      .filter(stream => stream.container === 'webm' && stream.resolution === '1080p')
      .map(stream => stream.url)[0];
    const audioUrl = audioStreams
      .filter(stream => stream.container === 'm4a' && stream.audioQuality === 'AUDIO_QUALITY_MEDIUM')
      .map(stream => stream.url)[0];
    const streamUrls = audioStreams
      .filter(stream => stream.container === 'webm' && stream.resolution)
      .map(stream => ({
        url: stream.url,
        resolution: stream.resolution,
      }));
      if (videoInfo.hlsUrl) {
        streamUrl = `/wkt/live/s/${videoId}`;
      }
    
    const templateData = {
      stream_url: streamUrl,
      highstreamUrl: highstreamUrl,
      audioUrl: audioUrl,
      videoId: videoId,
      channelId: videoInfo.authorId,
      channelName: videoInfo.author,
      channelImage: videoInfo.authorThumbnails?.[videoInfo.authorThumbnails.length - 1]?.url || '',
      videoTitle: videoInfo.title,
      videoDes: videoInfo.descriptionHtml,
      videoViews: videoInfo.viewCount,
      likeCount: videoInfo.likeCount,
      streamUrls: streamUrls
    };
          
    return(templateData);
  } catch (error) {
    return error;
  }
}

function getFirstVideoId(query) {
    return ytsr(query)
        .then((searchResults) => {
            if (searchResults && searchResults.items && searchResults.items.length > 0) {
                const firstVideo = searchResults.items.find(item => item.type === 'video');
                if (firstVideo) {
                    return firstVideo.id;
                }
            }
            throw new Error('動画が見つかりませんでした');
        })
        .catch(error => {
            console.error('エラー:', error);
        });
}

app.all("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/webhook", (req, res) => {
  const { body, message_id: messageId,account_id: accountId, room_id: roomId } = req.body.webhook_event;

  if (accountId === 10514686) {
    return res.sendStatus(200);
  }

  getwakametube(body, messageId, roomId, accountId);

  res.sendStatus(200);
});

async function sendCW(message, messageId, roomId, acId) {
  try {
    const ms = `[rp aid=${acId} to=${roomId}-${messageId}][pname:${acId}]さん\n${message}`;
    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      new URLSearchParams({ body: ms }),
      {
        headers: {
          "X-ChatWorkToken": CHATWORK_API_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
  } catch (error) {
    console.error("えらー", error.response?.data || error.message);
  }
}

async function getwakametube(message, messageId, roomId, accountId) {
  const ms = message.replace(/\s+/g, "");
  const regex = /「(.*?)」/;
  const matchid = ms.match(regex);
  if (matchid && matchid[1]) {
    try{
      const searchQuery = matchid[1];

     const videoId3 = await getFirstVideoId(searchQuery)
  　　　　.then(videoId => {
         return videoId;
         });
     const videoData = await getYouTube(videoId3);
      
     const streamUrl = videoData.stream_url;
     const videoTitle = videoData.videoTitle;
     const sssl = `https://www.youtube-nocookie.com/embed/${videoId3}`
     
    if (streamUrl) {
      await sendCW(`${videoTitle}\n${streamUrl}\n\nこちらのURLでも再生できるかもしれません\n${sssl}`, messageId, roomId, accountId);
      return;
    }
    }catch (error) {
    await sendCW("エラーが発生しました。", messageId, roomId, accountId);
    return;
  }
  }
  
  const match = ms.match(YOUTUBE_URL);

  if (match) {
    const videoId = match[1];

    try {
      const videoData = await getYouTube(videoId3);
      const streamUrl = videoData.stream_url;
      const videoTitle = videoData.videoTitle;
      const sssl = `https://www.youtube-nocookie.com/embed/${videoId}`
      await sendCW(`${videoTitle}\n${streamUrl}\n\nこちらのURLでも再生できるかもしれません\n${sssl}`, messageId, roomId, accountId);
      return;
    } catch (error) {
      console.error("APIリクエストエラー:", error);
      await sendCW(`えらー。あらら。`, roomId);
      return;
    }
  } else {
    await sendCW(`URLが無効です。正しいYouTubeのURLを入力してください。`, roomId);
  }
  return;
}


app.listen(port, () => {
  console.log(`listening on port ${port}`)
})
