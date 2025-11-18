const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeInMemoryStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

// Setup interface untuk input terminal (agar bisa input nomor HP)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => {
    return new Promise((resolve) => rl.question(text, resolve));
};

// Fungsi utama untuk menjalankan bot
async function startBot() {
    // 1. Setup Autentikasi (Session disimpan di folder 'auth_info')
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // 2. Konfigurasi Socket Baileys
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Ubah 'silent' ke 'info' jika ingin melihat log debug
        printQRInTerminal: false, // Kita matikan QR karena pakai OTP/Pairing Code
        auth: state,
        browser: Browsers.macOS('Desktop'), // Browser identifier agar terbaca sebagai device desktop
        markOnlineOnConnect: true
    });

    // 3. Logika Pairing Code (OTP) jika belum terdaftar
    if (!sock.authState.creds.registered) {
        console.log('Silakan masukkan nomor WhatsApp Anda untuk login.');
        console.log('Contoh: 6281234567890 (tanpa tanda + atau spasi)');
        
        const phoneNumber = await question('Masukkan Nomor WA: ');
        
        // Bersihkan nomor dari karakter non-angka
        const sanitizedNumber = phoneNumber.replace(/[^0-9]/g, '');

        setTimeout(async () => {
            // Request Pairing Code
            const code = await sock.requestPairingCode(sanitizedNumber);
            console.log(`\nKODE PAIRING ANDA: ${code}`);
            console.log('Silakan buka WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat -> Tautkan dengan nomor telepon saja.');
        }, 3000);
    }

    // 4. Handle Update Koneksi (Reconnecting, Close, Open)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Mencoba reconnect:', shouldReconnect);
            
            // Hapus session jika logout, jika tidak, reconnect ulang
            if (shouldReconnect) {
                startBot();
            } else {
                console.log('Anda telah Logout. Silakan hapus folder auth_info dan scan ulang.');
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung ke WhatsApp!');
        }
    });

    // 5. Handle Update Kredensial (Simpan session secara berkala)
    sock.ev.on('creds.update', saveCreds);

    // 6. Handle Pesan Masuk (Menerima & Mengirim)
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            
            // Abaikan pesan dari diri sendiri atau status broadcast
            if (!msg.message || msg.key.fromMe) return;

            // Mendapatkan nomor pengirim
            const remoteJid = msg.key.remoteJid;
            
            // Ekstrak isi pesan (bisa berupa text biasa atau extended text)
            const textMessage = msg.message.conversation || 
                                msg.message.extendedTextMessage?.text || 
                                "";

            console.log(`[PESAN MASUK] Dari: ${remoteJid} | Isi: ${textMessage}`);

            // --- LOGIKA MEMBALAS PESAN (CONTOH) ---
            
            // Contoh 1: Auto-reply sederhana
            if (textMessage.toLowerCase() === 'halo') {
                await sock.sendMessage(remoteJid, { 
                    text: 'Halo juga! Saya adalah Bot Node.js.' 
                }, { quoted: msg });
            }

            // Contoh 2: Perintah !ping
            if (textMessage.toLowerCase() === '!ping') {
                await sock.sendMessage(remoteJid, { 
                    text: 'Pong! 🏓' 
                }, { quoted: msg });
            }

            // Contoh 3: Mengirim pesan balasan berupa gambar (jika diperlukan)
            // Anda bisa menggunakan buffer atau url
            if (textMessage.toLowerCase() === '!info') {
                await sock.sendMessage(remoteJid, {
                    text: 'Bot ini dibuat menggunakan library Baileys.\nFitur: Login OTP, Terima Pesan, Kirim Pesan.'
                });
            }

        } catch (error) {
            console.error('Error memproses pesan:', error);
        }
    });
}

// Jalankan fungsi utama
startBot();
