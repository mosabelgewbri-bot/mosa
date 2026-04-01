const express = require('express');
const cors = require('cors');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

// تحديد المنفذ ديناميكياً ليتوافق مع Render
const PORT = process.env.PORT || 3000;

let sock;
let isConnected = false;

async function connectToWhatsApp() {
    // استخدام مجلد محلي لحفظ الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // سيظهر الـ QR في Logs موقع Render
        logger: pino({ level: 'silent' }) // تقليل الرسائل المزعجة في الـ Logs
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('--- QR CODE READY ---');
            console.log('Check Render Logs to scan the QR Code');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
            isConnected = false;
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected Successfully!');
            isConnected = true;
        }
    });
}

// نقطة فحص حالة السيرفر (Health Check) لمنع الـ Timeout في Render
app.get('/', (req, res) => {
    res.send(isConnected ? "WhatsApp Server is Online 🚀" : "WhatsApp Server is Offline 💤");
});

// API فحص رقم الهاتف
app.post('/check-number', async (req, res) => {
    if (!isConnected) {
        return res.status(503).json({ error: "الواتساب غير متصل حالياً" });
    }

    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "يرجى إرسال الرقم" });

    try {
        // تنظيف الرقم من أي رموز زائدة
        const cleanNumber = phone.replace(/\D/g, '');
        const [result] = await sock.onWhatsApp(cleanNumber);

        res.json({
            exists: !!result?.exists,
            jid: result?.jid || null
        });
    } catch (err) {
        console.error('Error checking number:', err);
        res.status(500).json({ error: "فشل في فحص الرقم برمجياً" });
    }
});

// تشغيل السيرفر أولاً ثم بدء اتصال الواتساب لتجنب الـ Timeout
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsApp();
});