const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Esta máquina tiene poca RAM libre; reduzco workers para evitar que el
// empaquetador muera por OOM ("Killed") al compilar para Android/iOS.
config.maxWorkers = 1;

module.exports = config;