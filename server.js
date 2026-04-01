const express = require('express');
const cors = require('cors');
const pino = require('pino');
const QRCode = require('qrcode'); // استدعاء مكتبة توليد الصور
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let sock;
let isConnected = false;
let lastQR = null; // متغير لتخزين الرمز

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // تحويل الرمز النصي إلى صورة (Data URL) ليظهر في المتصفح
            lastQR = await QRCode.toDataURL(qr);
            console.log('New QR Code generated');
        }

        if (connection === 'close') {
            lastQR = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
            isConnected = false;
        } else if (connection === 'open') {
            lastQR = null;
            isConnected = true;
            console.log('✅ Connected!');
        }
    });
}

// تعديل المسار الرئيسي ليعرض الرمز تلقائياً
app.get('/', (req, res) => {
    if (isConnected) {
        res.send("<h1>WhatsApp Server is Online 🚀</h1>");
    } else if (lastQR) {
        res.send(`<h1>Scan QR Code</h1><img src="${lastQR}" width="300"/><p>حدث الصفحة إذا انتهت صلاحية الرمز</p>`);
    } else {
        res.send("<h1>WhatsApp Server is Offline 💤</h1><p>انتظر ثواني لتوليد الرمز...</p>");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectToWhatsApp();
});