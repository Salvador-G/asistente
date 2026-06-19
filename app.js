const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const https = require('https');

// === CONFIGURACIÓN ===
const NUMERO_DESTINO = '51999888777@c.us'; 
const MINUTOS_MIN_RETRASO = 1;
const MINUTOS_MAX_RETRASO = 5;
const CODIGO_PAIS_FERIADOS = 'PE'; // Perú

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

client.on('qr', (qr) => {
    console.log('\n[!] Escanea el código QR para iniciar sesión:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('\n[✓] ¡Bot de asistencia conectado y listo!');
    console.log('[ℹ] Monitor de Sábados activo.\n');
    
    // === BLOQUE DIAGNÓSTICO TEMPORAL ===
    try {
        console.log('[🔍] Extrayendo lista de chats para identificar el grupo...');
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup);
        
        console.log('\n==================== GRUPOS ENCONTRADOS ====================');
        grupos.forEach(grupo => {
            console.log(`📌 Nombre del Grupo: ${grupo.name}`);
            console.log(`🆔 ID de Destino:    ${grupo.id._serialized}`);
            console.log('------------------------------------------------------------');
        });
        console.log('============================================================\n');
        
    } catch (error) {
        console.error('[❌] Error al listar los grupos:', error);
    }

    // Probar la API de feriados inmediatamente al iniciar
    console.log('[🔍] Probando conexión con la API de feriados...');
    const pruebaFeriado = await esFeriadoHoy();
    console.log(`[📊 RESULTADO TEST] ¿Hoy está registrado como feriado?: ${pruebaFeriado ? 'SÍ 🌴' : 'NO 💼'}\n`);
    // ===================================

    iniciarAutomatizacion();
});

// === COMPROBADOR DE FERIADOS ===
/**
 * Verifica si la fecha de hoy es un feriado en Perú
 * @returns {Promise<boolean>}
 */
function esFeriadoHoy() {
    return new Promise((resolve) => {
        const hoy = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima' }); // Formato "DD/MM/YYYY"
        const [dia, mes, anio] = hoy.split('/');
        const fechaFormatoAPI = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`; // "YYYY-MM-DD"

        // Usamos una API pública y estable de feriados (por ejemplo, date.nager.at que cubre Perú)
        const url = `https://date.nager.at/api/v3/PublicHolidays/${anio}/${CODIGO_PAIS_FERIADOS}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const feriados = JSON.parse(data);
                    // Buscamos si la fecha de hoy está en la lista de feriados del año
                    const existeFeriado = feriados.some(f => f.date === fechaFormatoAPI);
                    resolve(existeFeriado);
                } catch (e) {
                    console.error('[⚠️] Error al procesar los feriados de la API, se asumirá que NO es feriado por seguridad.');
                    resolve(false);
                }
            });
        }).on('error', (err) => {
            console.error('[⚠️] No se pudo conectar a la API de feriados:', err.message);
            resolve(false); // Si la API cae, por defecto asume que no es feriado para no dejarte sin marcar
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

    // Cambiado a '6' (Sábado). Ejemplo: Entrada a las 08:55 AM
    cron.schedule('55 8 * * 6', async () => {
        console.log('\n[🔍] Verificando calendario de asistencia...');
        const hoyEsFeriado = await esFeriadoHoy();
        
        if (hoyEsFeriado) {
            console.log('[🌴] ¡Hoy es feriado oficial! El bot no enviará ningún mensaje de entrada.');
            return; // Aborta la operación
        }

        programarEnvioConRetraso('Buenos días, registro mi entrada.', 'ENTRADA (SÁBADO)');
    }, cronOptions);

    // Salida a las 01:05 PM (13:05) por ser sábado
    cron.schedule('5 13 * * 6', async () => {
        console.log('\n[🔍] Verificando calendario de asistencia...');
        const hoyEsFeriado = await esFeriadoHoy();
        
        if (hoyEsFeriado) {
            console.log('[🌴] ¡Hoy es feriado oficial! El bot no enviará ningún mensaje de salida.');
            return; // Aborta la operación
        }

        programarEnvioConRetraso('Buenas tardes, registro mi salida. Buen fin de semana.', 'SALIDA (SÁBADO)');
    }, cronOptions);
}

client.initialize();