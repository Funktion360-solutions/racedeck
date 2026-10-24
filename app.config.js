// Shared beta access token, not the ElevenLabs API key. The token is embedded
// in the installed app; never use this mechanism for provider credentials.
const fs = require('node:fs');
const path = require('node:path');
module.exports = ({ config }) => {
  const filename = path.join(__dirname, 'cloud-voice.local.json');
  if (!fs.existsSync(filename)) return config;
  const local = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (local.ttsEnabled !== true || typeof local.ttsToken !== 'string' || local.ttsToken.length < 32 || local.ttsUrl !== 'https://racedeck.funktion360.dk/api/tts') throw new Error('Ugyldig lokal stemmeopsætning. Kør npm run prepare:voice igen.');
  return { ...config, extra: { ...config.extra, racedeck: local } };
};
