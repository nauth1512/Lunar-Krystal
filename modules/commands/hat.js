// modules/commands/hat.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ytSearch = require("yt-search");

module.exports = {
  config: {
    name: "hat",
    aliases: ["sing", "music", "song"],
    version: "1.0.0",
    author: "ArYAN | việt hoá: Nauth",
    countDown: 5,
    role: 0,
    shortDescription: "Tìm và gửi nhạc/vid từ YouTube",
    longDescription: "Nhập tên bài hát, bot sẽ tìm trên YouTube và gửi audio (mặc định) hoặc video.",
    category: "Âm nhạc",
    guide: "{pn} <tên bài hát> [audio|video]\nVD: {pn} dj lappa lappa\nVD: {pn} sơn tùng making my way video",
  },

  onStart: async function ({ api, event, args }) {
    // fallback cho môi trường không có TTY (tránh crash)
    if (!process.stderr.clearLine) process.stderr.clearLine = () => {};
    if (!process.stderr.cursorTo) process.stderr.cursorTo = () => {};

    let type = "audio";
    let songName = "";

    // nếu từ cuối là audio/video thì tách ra làm type
    if (args.length > 1 && ["audio", "video"].includes(args[args.length - 1].toLowerCase())) {
      type = args.pop().toLowerCase();
    }
    songName = args.join(" ").trim();

    if (!songName) {
      return api.sendMessage("❌ Nhập tên bài hát đi m ơi.", event.threadID, event.messageID);
    }

    // gửi tin nhắn chờ xử lý
    const pending = await api.sendMessage("🎵 Đang tìm và tải... đợi xíu nha...", event.threadID, null, event.messageID);

    try {
      // 1) Tìm YouTube
      const searchResults = await ytSearch(songName);
      if (!searchResults || !searchResults.videos || !searchResults.videos.length) {
        throw new Error("Không tìm thấy kết quả phù hợp.");
      }

      const top = searchResults.videos[0];
      const videoId = top.videoId;

      // 2) Gọi API lấy link tải trực tiếp (bên thứ ba có thể chập chờn)
      const apiKey = "itzaryan";
      const apiUrl = `https://xyz-nix.vercel.app/aryan/youtube?id=${videoId}&type=${type}&apikey=${apiKey}`;

      api.setMessageReaction("⌛", event.messageID, () => {}, true);

      const { data } = await axios.get(apiUrl, { timeout: 20000 });
      const downloadUrl = data?.downloadUrl;
      if (!downloadUrl) throw new Error("API không trả về link tải (downloadUrl).");

      // 3) Tải file về dạng buffer
      const fileExt = type === "audio" ? "mp3" : "mp4";
      const safeTitle = (top.title || "music")
        .replace(/[/\\?%*:|"<>]/g, "")   // bỏ ký tự cấm trên file system
        .slice(0, 100)                   // giới hạn độ dài tên file
        .trim() || "music";
      const filename = `${safeTitle}.${fileExt}`;

      const cacheDir = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const filePath = path.join(cacheDir, filename);

      const fileRes = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      fs.writeFileSync(filePath, Buffer.from(fileRes.data));

      api.setMessageReaction("✅", event.messageID, () => {}, true);

      // 4) Gửi file
      await api.sendMessage(
        {
          body: `🎵 𝗡𝗛𝗔̣𝗖\n━━━━━━━━━━━━━━━\n${top.title}\n\n⏱️ ${top.timestamp || "—"} | 👀 ${top.views?.toLocaleString?.() || top.views || "—"}`,
          attachment: fs.createReadStream(filePath)
        },
        event.threadID,
        () => {
          try { fs.unlinkSync(filePath); } catch {}
          if (pending?.messageID) api.unsendMessage(pending.messageID);
        },
        event.messageID
      );
    } catch (err) {
      console.error("[hat] Lỗi:", err?.message);
      if (pending?.messageID) api.unsendMessage(pending.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      api.sendMessage(`❌ Tải/gửi bài thất bại: ${err?.message || err}`, event.threadID, event.messageID);
    }
  },
};
