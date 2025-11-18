const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true // QR muncul di terminal
    })

    sock.ev.on('creds.update', saveCreds)

    // 🔔 Menerima pesan masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            const msg = messages[0]
            if (!msg.key.fromMe) {
                console.log('Pesan dari:', msg.key.remoteJid)
                console.log('Isi pesan:', msg.message?.conversation)

                // Contoh: auto-reply
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pesanmu sudah saya terima 👍' })
            }
        }
    })
}

startSock()
