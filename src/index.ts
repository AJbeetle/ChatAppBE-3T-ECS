import { OrganizeImportsMode } from "typescript";
import {WebSocketServer, WebSocket} from "ws"
import dotenv from "dotenv";
import crypto from "crypto";
import { insertMessage } from "./repos/messageRepo";
import { ensureRoom } from "./repos/messageRepo";

dotenv.config();


// Creating Redis Client
import Redis from "ioredis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT) || 6379;

const pub = new Redis(redisPort, redisHost);
const sub = new Redis(redisPort, redisHost);


if (!process.env.PORT) {
  throw new Error("PORT is not defined in environment variables");
}

const wsPORT: number = parseInt(process.env.PORT, 10);

const wss = new WebSocketServer({ port: wsPORT });

let userCount = 0;

// let sck:WebSocket[] = [];

//now the socket should look something like this, use maps and Records here
/* let allSockets = {
    "room1" : [socket1, socket2],
    "123sdr" : [socker3, socket4],
    "43trh" : [socket5, socket6]
} */

let sck:Record<string, WebSocket[]> = {}; 

// Redis Subscriber handler : distributed broadcast point
sub.on("message", (channel, message) => {
  let data;
  try {
    data = JSON.parse(message);
  } catch {
    return;
  }
  const sockets = sck[channel];
    
  if (!sockets) return;
    
  // skipping the sender in subscriber handler
  sockets.forEach((socket) => {
    const socketConnectionId = (socket as any).connectionId;
  
    if (socketConnectionId === data.senderConnectionId) return;
  
    socket.send(data.message);
  });
});

interface userMessage {
    type : string,
    payload : {
        roomId : string,
        user? : string,
        userId? : string,
        userAvatar? : string,
        message? :string
    }
}

wss.on("connection",function(socket){
    
    const connectionId = crypto.randomUUID();
    // attach metadata to socket
    (socket as any).connectionId = connectionId;

    socket.send("WebSocket connection established");
    socket.on("message",async (event)=>{
        //event here now is stringified JSON object, having types now check if user wants to chat or join the room
        // check for the message type in JSON Object by unstringifying it

        let userMessage: userMessage;

        try {
          userMessage = JSON.parse(event.toString());
        } catch {
          return;
        }

        if(userMessage.type == "join"){
            let roomId = userMessage.payload.roomId as string;
            // let arr = sck[roomId];
            // sck[roomId] = [...arr, socket];

            if (!sck[roomId]) {
              sck[roomId] = [];
              // first user in this container → subscribe Redis
              await sub.subscribe(roomId);
              ensureRoom(roomId).catch(console.error);
            }
            sck[roomId].push(socket);
        }
        else if(userMessage.type == "chat"){

            // Server doesn't broadcast directly redis will publish
            const {roomId, message} = userMessage.payload;
            if (!message) return;

            // Redis message contains sender identity.
            await pub.publish(
              roomId,
              JSON.stringify({
                roomId,
                message,
                senderConnectionId: (socket as any).connectionId
              })
            );

            // async DB write (do not block realtime)
            insertMessage(roomId, (socket as any).connectionId, message).catch(console.error);
        }
    })

    // Adding disconnect cleanup : prevents redis channel explosion
    socket.on("close", async () => {
      for (const roomId in sck) {
        sck[roomId] = sck[roomId].filter((s) => s !== socket);

        if (sck[roomId].length === 0) {
          delete sck[roomId];
          await sub.unsubscribe(roomId);
        }
      }
    });
})


