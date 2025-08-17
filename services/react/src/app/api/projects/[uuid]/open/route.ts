import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = await params;

    // Get the request body
    const requestBody = await request.json();

    // Forward the request to the backend with all cookies
    const backendUrl = `http://10.43.103.145.nip.io:9081/v0/projects/${uuid}:open`;

    console.log('Forwarding open request to:', backendUrl);
    console.log('Request cookies:', request.headers.get('cookie'));
    console.log('Request body:', requestBody);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody), // Forward the actual request body
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { error: `Backend returned ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
