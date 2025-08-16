import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check authentication by forwarding to backend with cookies
    const backendUrl = 'http://10.43.103.145.nip.io:9081/v0/me';

    console.log('Checking authentication at:', backendUrl);
    console.log('Request cookies:', request.headers.get('cookie'));

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Backend auth check response status:', response.status);

    if (!response.ok) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    const userData = await response.json();
    return NextResponse.json({
      authenticated: true,
      user: userData
    });

  } catch (error) {
    console.error('Auth check API route error:', error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
