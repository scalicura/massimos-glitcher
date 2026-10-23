// Read-only protocol probes. Certificate and hostname verification stay enabled.
import tls from 'node:tls';
const host = 'max.calicura.net';
const results = [];
for (const version of ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']) {
  results.push(await new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host,
      minVersion: version, maxVersion: version, rejectUnauthorized: true,
      // Permit legacy offers for the probe; never use this cipher policy in an app.
      ciphers: version === 'TLSv1' || version === 'TLSv1.1' ? 'DEFAULT:@SECLEVEL=0' : undefined,
    });
    socket.setTimeout(10000, () => socket.destroy(new Error('Connection timed out')));
    socket.once('error', (error) => resolve({ offered: version, accepted: false, error: error.message }));
    socket.once('secureConnect', () => {
      const chain = [];
      const seen = new Set();
      let cert = socket.getPeerCertificate(true);
      while (cert?.fingerprint256 && !seen.has(cert.fingerprint256)) {
        seen.add(cert.fingerprint256);
        chain.push({ subject: cert.subject, issuer: cert.issuer, validFrom: cert.valid_from,
          validTo: cert.valid_to, fingerprint256: cert.fingerprint256, subjectaltname: cert.subjectaltname });
        cert = cert.issuerCertificate;
      }
      resolve({ offered: version, accepted: true, authorized: socket.authorized,
        protocol: socket.getProtocol(), cipher: socket.getCipher(), chain });
      socket.end();
    });
  }));
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), host,
  client: { node: process.version, openssl: process.versions.openssl }, results }, null, 2));
