// Vercel Serverless Function – Secure JSON persistence
// Save the entire `brands` object to /data/brands.json
// Protected by a secret token (SAVE_TOKEN) and encrypted with ENCRYPTION_KEY.

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers['x-save-token'];
  if (!token || token !== process.env.SAVE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Limit payload size to 1MB
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 1024 * 1024) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  try {
    const { brands } = req.body;
    if (!brands || typeof brands !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Encrypt data
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(brands), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const fs = require('fs').promises;
    const path = require('path');
    const outPath = path.resolve(process.cwd(), 'data', 'brands.enc');
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    
    const output = JSON.stringify({ iv: iv.toString('hex'), data: encrypted });
    await fs.writeFile(outPath, output, 'utf8');
    
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('saveData error:', err);
    return res.status(500).json({ error: err.message });
  }
}
