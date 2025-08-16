import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_session_id } = body;

    // Forward logout request to the backend with cookies
    const backendUrl = 'http://10.43.103.145.nip.io:9081/v0/auth/logout';

    console.log('Forwarding logout request to:', backendUrl);
    console.log('Request cookies:', request.headers.get('cookie'));

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ client_session_id }),
    });

    console.log('Backend logout response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend logout error:', errorText);
      return NextResponse.json(
        { error: `Logout failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Create the response
    const nextResponse = NextResponse.json(data);

    // Clear any auth cookies
    nextResponse.headers.append('Set-Cookie', 'osparc=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

    return nextResponse;

  } catch (error) {
    console.error('Logout API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
