import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors());

interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: any;
}

app.post('/fetch', async (c) => {
  try {
    const body = await c.req.json() as ProxyRequest;
    
    if (!body.url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Extract the values from the incoming request
    const { url, method, headers, data } = body;
    console.log('Proxy request:', { url, method, headers, data });
    // Prepare the request configuration
    const requestInit: RequestInit = {
      method: method || 'GET',
      headers: headers || {},
    };

    // Add body data if present and not a GET request
    if (data && method !== 'GET') {
      requestInit.body = JSON.stringify(data);
    }

    // Make the request
    const response = await fetch(url, requestInit);
    
    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body based on content type
    let responseBody;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    // Return the response
    return c.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: responseBody
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
});

export default app;
