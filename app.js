const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// === SERVIDOR DUMMY PARA DOKPLOY ===
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de WhatsApp funcionando correctamente.\n');
}).listen(PORT, () => {
    console.log(`[🌐] Servidor web dummy escuchando en el puerto ${PORT}`);
});

// === CONFIGURACIÓN ===
const NUMERO_DESTINO = '120363398248762250@g.us'; 
const MINUTOS_MIN_RETRASO = 1;
const MINUTOS_MAX_RETRASO = 5;
const CODIGO_PAIS_FERIADOS = 'PE'; // Perú

// === LIMPIEZA DE BLOQUEOS (ANTI-CRASH) ===
const lockPath = path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonLock');
if (fs.existsSync(lockPath)) {
    try {
        fs.unlinkSync(lockPath);
        console.log('[🧹] Candado fantasma de Chromium (SingletonLock) eliminado exitosamente.');
    } catch (err) {
        console.error('[⚠️] No se pudo eliminar el SingletonLock:', err);
    }
}

// === INICIALIZACIÓN DEL CLIENTE ===
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// === EVENTOS DEL CLIENTE ===
client.on('qr', (qr) => {
    console.log('\n[!] Escanea el código QR para iniciar sesión:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n[✓] ¡Bot de asistencia conectado y listo!');
    console.log('[ℹ] Sistema automatizado activo en background. Esperando horarios programados...\n');
    iniciarAutomatizacion();
});

// Eventos de seguridad por si cierras sesión manualmente desde el celular
client.on('auth_failure', msg => {
    console.error('\n[💥] FALLO DE AUTENTICACIÓN:', msg);
    console.log('[🧹] La sesión fue revocada. Forzando reinicio y auto-limpieza...');
    process.exit(1); 
});

client.on('disconnected', (reason) => {
    console.log('\n[🔌] CLIENTE DESCONECTADO. Razón:', reason);
    if (reason === 'NAVIGATION' || reason === 'LOGOUT') {
        console.log('[🧹] Sesión cerrada. Apagando para auto-limpieza...');
        process.exit(1); 
    }
});

// === COMPROBADOR DE FERIADOS ===
function esFeriadoHoy() {
    return new Promise((resolve) => {
        const hoy = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' }); 
        const [dia, mes, anio] = hoy.split('/');
        const fechaFormatoAPI = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

        const url = `https://date.nager.at/api/v3/PublicHolidays/${anio}/${CODIGO_PAIS_FERIADOS}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const feriados = JSON.parse(data);
                    const existeFeriado = feriados.some(f => f.date === fechaFormatoAPI);
                    resolve(existeFeriado);
                } catch (e) {
                    console.error('[⚠️] Error en API de feriados, asumiendo día laborable.');
                    resolve(false);
                }
            });
        }).on('error', (err) => {
            console.error('[⚠️] Error de red con API de feriados:', err.message);
            resolve(false);
        });
    });
}

// === ENVIAR MENSAJE CON RETRASO HUMANO ===
function programarEnvioConRetraso(mensaje, tipo) {
    const minutosAleatorios = Math.floor(Math.random() * (MINUTOS_MAX_RETRASO - MINUTOS_MIN_RETRASO + 1)) + MINUTOS_MIN_RETRASO;
    const milisegundos = minutosAleatorios * 60 * 1000;
    
    console.log(`[⏳] Horario base alcanzado para: ${tipo}. Esperando ${minutosAleatorios} minutos para simular factor humano...`);

    setTimeout(async () => {
        try {
            const chat = await client.getChatById(NUMERO_DESTINO);
            await chat.sendMessage(mensaje);
            const horaEnvio = new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' });
            console.log(`[✅] Mensaje de ${tipo} enviado exitosamente a las ${horaEnvio}`);
        } catch (error) {
            console.error(`[❌] Error al enviar el mensaje de ${tipo}:`, error);
        }
    }, milisegundos);
}

// === PROGRAMACIÓN DE HORARIOS (SÁBADOS) ===
function iniciarAutomatizacion() {
    const cronOptions = {
        scheduled: true,
        timezone: "America/Lima"
    };

    // Sábado a las 08:55 AM
    cron.schedule('55 8 * * 6', async () => {
        console.log('\n[🔍] Verificando si hoy es feriado...');
        if (await esFeriadoHoy()) {
            console.log('[🌴] ¡Hoy es feriado oficial! No se enviará mensaje de entrada.');
            return;
        }
        programarEnvioConRetraso('Buenos días, salvador ingreso', 'ENTRADA (SÁBADO)');
    }, cronOptions);

    // Sábado a las 01:05 PM
    cron.schedule('5 13 * * 6', async () => {
        console.log('\n[🔍] Verificando si hoy es feriado...');
        if (await esFeriadoHoy()) {
            console.log('[🌴] ¡Hoy es feriado oficial! No se enviará mensaje de salida.');
            return;
        }
        programarEnvioConRetraso('Salida salvador', 'SALIDA (SÁBADO)');
    }, cronOptions);
}

// === INICIALIZACIÓN AUTO-RECUPERABLE ===
(async () => {
    try {
        console.log('[⚙️] Inicializando cliente de WhatsApp...');
        await client.initialize();
    } catch (error) {
        console.error('\n[💥] ERROR CRÍTICO AL INICIALIZAR:', error.message);
        console.log('[🧹] Iniciando protocolo de limpieza de sesión corrupta...');
        
        const authPath = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
            try {
                const contenidos = fs.readdirSync(authPath);
                for (const item of contenidos) {
                    const itemPath = path.join(authPath, item);
                    fs.rmSync(itemPath, { recursive: true, force: true });
                }
                console.log('[✅] Contenido de la sesión corrupta vaciado exitosamente.');
            } catch (rmError) {
                console.error('[⚠️] No se pudo vaciar la carpeta:', rmError);
            }
        }
        console.log('[🔄] Forzando apagado. Dokploy reiniciará el contenedor en breve...\n');
        process.exit(1); 
    }
})();