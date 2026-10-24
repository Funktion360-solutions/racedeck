const fs = require('node:fs');
const path = require('node:path');
const ENDPOINT = 'https://racedeck.funktion360.dk/api/tts';
async function verify(token, fetchImpl = fetch) {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('Tokenet skal være de 64 tegn fra openssl rand -hex 32.');
  // Empty text is deliberately invalid. A correctly configured server rejects
  // it before ElevenLabs is called, so this test consumes no speech credits.
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '' }),
  });
  if (response.status === 400) {
    const payload = await response.json();
    if (payload.error === 'Teksten skal indeholde 1–300 tegn.') return true;
  }
  if (response.status === 503) throw new Error('Stemmeserveren er stadig lukket eller mangler opsætning i Vercel. Kontrollér flag og redeploy.');
  if (response.status === 401) throw new Error('Tokenet matcher ikke RACEDECK_APP_TOKEN på Vercel.');
  if (response.status === 429) throw new Error('Rategrænsen er nået. Vent et minut og prøv igen.');
  throw new Error(`Stemmeserveren er ikke klar (HTTP ${response.status}). Kontrollér seneste Vercel-deployment.`);
}
function readHidden() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error('Kør kommandoen direkte i Terminal.'));
    let value = '';
    process.stdout.write('Indsæt det NYE RACEDECK_APP_TOKEN (skjult), og tryk Enter: ');
    process.stdin.setRawMode(true); process.stdin.setEncoding('utf8'); process.stdin.resume();
    const finish = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = input => {
      for (const char of input) {
        if (char === '\u0003') { finish(); reject(new Error('Afbrudt.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(value.trim()); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (/[a-f0-9]/i.test(char)) value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}
async function main() {
  const token = await readHidden();
  console.log('Kontrollerer forbindelsen uden at generere tale …');
  await verify(token);
  const file = path.join(__dirname, '..', 'cloud-voice.local.json');
  fs.writeFileSync(file, JSON.stringify({ ttsEnabled: true, ttsUrl: ENDPOINT, ttsToken: token }, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log('Stemmeopsætningen er klar og udeladt fra Git. Tokenet medtages i appens EAS-build.');
  console.log('Start buildet: npx eas-cli@latest build --platform ios --profile production');
}
module.exports = { verify };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
