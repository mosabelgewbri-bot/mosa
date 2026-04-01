const express = require('express');
const cors = require('cors');
const pino = require('pino');
const QRCode = require('qrcode'); // تأكد من إضافة هذه المكتبة
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

let sock;
let isConnected = false;
let lastQR = null; // متغير لتخزين الرمز الأخير

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
            // تحويل الرمز إلى رابط صورة (Data URL) ليتم عرضه في المتصفح
            lastQR = await QRCode.toDataURL(qr);
            console.log('--- QR CODE UPDATED ---');
        }

        if (connection === 'close') {
            lastQR = null;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
            isConnected = false;
        } else if (connection === 'open') {
            lastQR = null; // مسح الرمز بعد الاتصال الناجح
            isConnected = true;
            console.log('✅ WhatsApp Connected Successfully!');
        }
    });
}

// الصفحة الرئيسية
app.get('/', (req, res) => {
    if (isConnected) {
        res.send("<h1>WhatsApp Server is Online 🚀</h1>");
    } else if (lastQR) {
        res.send(`<h1>Scan this QR Code</h1><img src="${lastQR}" />`);
    } else {
        res.send("<h1>WhatsApp Server is Offline 💤</h1><p>Waiting for QR code...</p>");
    }
});

// إضافة مسار /qr الذي كنت تطلبه
app.get('/qr', (req, res) => {
    if (lastQR) {
        res.send(`<img src="${lastQR}" style="width:300px;"/>`);
    } else {
        res.send(isConnected ? "Connected already!" : "QR not ready yet, refresh in 10 seconds.");
    }
});

// باقي كود الـ API الخاص بـ check-number يبقى كما هو...

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsApp();
});