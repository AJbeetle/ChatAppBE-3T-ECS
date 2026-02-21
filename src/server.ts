import express from "express";
import { getMessages } from "./repos/messageRepo";
import dotenv from "dotenv";
dotenv.config();


const app = express();

app.get("/rooms/:roomId/messages", async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const messages = await getMessages(roomId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch messages" });
  }
});


app.listen(process.env.PORT_HTTP, () => {
  console.log("HTTP server running");
});