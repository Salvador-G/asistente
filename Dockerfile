FROM node:18-slim

# Instalar dependencias necesarias para Puppeteer en Linux
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libgbm-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install

# Copiar el código fuente
COPY . .

# Iniciar la aplicación
CMD [ "npm", "start" ]