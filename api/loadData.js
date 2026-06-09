// Vercel Serverless Function – Secure JSON retrieval
// Load the encrypted `brands` object from /data/brands.enc
// Protected by a secret token (SAVE_TOKEN) and decrypted with ENCRYPTION_KEY.

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers['x-save-token'];
  if (!token || token !== process.env.SAVE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const fs = require('fs').promises;
    const path = require('path');
    const inPath = path.resolve(process.cwd(), 'data', 'brands.enc');
    const fileContent = await fs.readFile(inPath, 'utf8');
    const { iv, data } = JSON.parse(fileContent);
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const brands = JSON.parse(decrypted);
    return res.status(200).json({ brands });
  } catch (err) {
    console.error('loadData error:', err);
    return res.status(500).json({ error: err.message });
  }
}
