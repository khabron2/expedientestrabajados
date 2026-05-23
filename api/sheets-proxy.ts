import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for robust safety, allowing client-side invocation from any deployed instance
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Instantly resolve CORS preflight pre-requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { url, method, data } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'La URL de destino es obligatoria.' });
  }

  try {
    console.log(`[Vercel Serverless Proxy] Redirecting request ${method || 'GET'} to target: ${url}`);
    
    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (method === 'POST' && data) {
      fetchOptions.body = JSON.stringify(data);
    }

    const remoteResponse = await fetch(url, fetchOptions);
    
    let responseBody: any;
    const contentType = remoteResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await remoteResponse.json();
    } else {
      const textData = await remoteResponse.text();
      try {
        responseBody = JSON.parse(textData);
      } catch {
        responseBody = textData;
      }
    }

    res.status(remoteResponse.status).json({
      success: remoteResponse.ok,
      status: remoteResponse.status,
      data: responseBody
    });

  } catch (err: any) {
    console.error('[Vercel Serverless Error]', err);
    res.status(500).json({
      success: false,
      error: `Fallo al conectar con el servidor de Google Sheets desde Vercel Serverless: ${err.message || String(err)}`
    });
  }
}
