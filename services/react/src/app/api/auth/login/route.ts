import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Forward login request to the backend
    const backendUrl = 'http://10.43.103.145.nip.io:9081/v0/auth/login';

    console.log('Forwarding login request to:', backendUrl);
    console.log('Login credentials:', { email, password: '***' });

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('Backend login response status:', response.status);
    console.log('Backend login response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend login error:', errorText);
      return NextResponse.json(
        { error: `Authentication failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Create the response
    const nextResponse = NextResponse.json(data);

    // Forward any cookies from the backend response, but modify domain for localhost
    const setCookieHeaders = response.headers.get('set-cookie');
    if (setCookieHeaders) {
      // Parse and forward cookies, modifying domain for localhost development
      const cookies = setCookieHeaders.split(',').map(cookie => cookie.trim());
      cookies.forEach(cookie => {
        // Replace the domain to work with localhost
        let modifiedCookie = cookie.replace(/Domain=\.[\w\.\-]+\.nip\.io/g, '');
        // Also remove Path and set it to root if needed
        if (!modifiedCookie.includes('Path=')) {
          modifiedCookie += '; Path=/';
        }
        nextResponse.headers.append('Set-Cookie', modifiedCookie);
      });
      console.log('Forwarding modified cookies:', cookies.map(cookie =>
        cookie.replace(/Domain=\.[\w\.\-]+\.nip\.io/g, '') + (cookie.includes('Path=') ? '' : '; Path=/')
      ));
    }

    return nextResponse;

  } catch (error) {
    console.error('Login API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
