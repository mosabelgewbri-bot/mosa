const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

let sock;

// مسار الصحة للتأكد من عمل السيرفر (مهم لـ Render)
app.get('/health', (req, res) => {
    res.json({ status: "online", connected: !!sock });
});

// دالة الاتصال بالواتساب
async function connectToWA() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: true,
        browser: ['Dar Al-Maqam Checker', 'Chrome', '1.0.0']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('QR Code generated. Please scan it in your terminal.');
        }
        if (connection === 'close') {
            console.log('Connection closed. Reconnecting...');
            connectToWA();
        } else if (connection === 'open') {
            console.log('WhatsApp Connected Successfully!');
        }
    });
}

// نقطة النهاية لفحص الرقم
app.post('/check-number', async (req, res) => {
    const { phone } = req.body;
    if (!sock) return res.status(500).json({ error: "الواتساب غير متصل" });

    try {
        const [result] = await sock.onWhatsApp(phone);
        res.json({ 
            exists: result?.exists || false,
            jid: result?.jid || null 
        });
    } catch (err) {
        console.error("Check error:", err);
        res.status(500).json({ error: "فشل الفحص" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    connectToWA();
});