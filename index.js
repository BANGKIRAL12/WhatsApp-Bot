const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("baileys")
const pino = require("pino")
const chalk = require("chalk")
const readline = require("readline")
const { resolve } = require("path")
const { version } = require("os")
import fetch from "node-fetch" // jika Node.js < 18

const usePairingCode = true
let messageToSend = ""

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./CahyaSesi")

  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`Cahya Using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    version: version,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
  })

  if (usePairingCode && !sock.authState.creds.registered) {
    try {
      const phoneNumber = await question('☘️ Masukan Nomor Yang Diawali Dengan 62 :\n')
      const code = await sock.requestPairingCode(phoneNumber.trim())
      console.log(`🎁 Pairing Code : ${code}`)
    } catch (err) {
      console.error('Failed to get pairing code:', err)
    }
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update
    if ( connection === "close") {
        console.log(chalk.red("❌  Koneksi Terputus, Mencoba Menyambung Ulang"))
        connectToWhatsApp()
    } else if ( connection === "open") {
        console.log(chalk.green("✔  Bot Berhasil Terhubung Ke WhatsApp"))
    }
  })

  sock.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages[0]
    if (!m.message || m.key.fromMe) return

    const sender = m.key.remoteJid
    const text = m.message.conversation || m.message.extendedTextMessage?.text

    console.log("Pesan dari:", sender, "isi:", text)

    // ambil data dari API dan tunggu hasilnya
    await getDataWithKey(text?.toLowerCase())
    await sock.sendMessage(sender, { text: messageToSend })
  })

  sock.ev.on("creds.update", saveCreds)
}

async function getDataWithKey(restKey) {
  const apiUrl = `https://script.google.com/macros/s/AKfycbw3LIIYcYCQPr2mBrtkmQg4Fypo17yir_o49mdEiI5ZQ9g7LOBywozOIANYrQf531azbg/exec?restKey=${restKey}`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) throw new Error(`Permintaan gagal: ${response.status}`)

    const data = await response.json()
    console.log("Data yang diterima:", data)

    // ambil field tertentu dari JSON
    messageToSend = data.message || JSON.stringify(data)
  } catch (error) {
    console.error("Terjadi kesalahan:", error.message)
    messageToSend = "Terjadi kesalahan saat mengambil data."
  }
}

startBot()
