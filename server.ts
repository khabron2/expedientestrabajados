import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set limits for larger JSON payload dumps
  app.use(express.json({ limit: '15mb' }));

  // API Proxy Route to handle Google Sheets API requests and completely bypass CORS
  app.post('/api/sheets-proxy', async (req, res) => {
    const { url, method, data } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'La URL de destino es obligatoria.' });
    }

    try {
      console.log(`[Proxy Server] Refecthing ${method || 'GET'} request to external URL: ${url}`);
      
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

      // Google Apps Script might return 200 even on error payload, but we pass authentic status code or status flag
      res.status(remoteResponse.status).json({
        success: remoteResponse.ok,
        status: remoteResponse.status,
        data: responseBody
      });

    } catch (err: any) {
      console.error('[Proxy Server Error]', err);
      res.status(500).json({
        success: false,
        error: `Fallo al conectar con el servidor de Google Sheets: ${err.message || String(err)}`
      });
    }
  });

  // Server health route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development vs static folder serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Fallback handler to guarantee index.html is loaded and processed by Vite in development
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CRM Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
