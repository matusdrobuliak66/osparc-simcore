# Development Task Plan - oSPARC React Frontend

## Project Overview
Building a React frontend for oSPARC with authentication and dashboard functionality.

## API Configuration
- **Base URL (local development)**: `/api/proxy` (proxied to `http://10.43.103.145.nip.io:9081`)
- **API Version**: `/v0`
- **CORS Solution**: Using Next.js rewrites to proxy requests and avoid CORS issues

## Authentication Endpoints
Based on OpenAPI specification:

### Login Endpoint
- **URL**: `POST /auth/login`
- **Request Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**: 200 OK with user data

### Logout Endpoint
- **URL**: `POST /auth/logout`
- **Request Body**:
  ```json
  {
    "client_session_id": "string"
  }
  ```
- **Response**: 200 OK with success message

## Task List

### Phase 1: Authentication Setup ✅
- [x] Create task planning file
- [x] Create API utilities and types
- [x] Create authentication context/state management
- [x] Create login page component
- [x] Create account dropdown component for logout
- [x] Implement authentication flow
- [x] Add protected route wrapper
- [x] Basic testing of components
- [ ] Test with real backend API endpoints
- [ ] Handle edge cases and error states

### Phase 2: Dashboard (Future)
- [ ] Create dashboard layout
- [ ] Add navigation components
- [ ] Implement project listing
- [ ] Add project management features

### Phase 3: Advanced Features (Future)
- [ ] User profile management
- [ ] Project creation/editing
- [ ] File management
- [ ] Collaborative features

## Implementation Notes

### Current Status: Starting Phase 1

### Next Steps:
1. Create API utilities with proper TypeScript types
2. Set up authentication context for state management
3. Build login page with form validation
4. Create logout functionality in top-right corner
5. Test complete authentication flow

### Technical Decisions:
- Using React Context for authentication state
- TypeScript for type safety
- Fetch API for HTTP requests
- Local storage for session persistence
- CSS modules or styled-components for styling

### Files to Create/Modify:
- `src/lib/api.ts` - API utilities
- `src/lib/auth-context.tsx` - Authentication context
- `src/types/auth.ts` - Authentication types
- `src/components/LoginPage.tsx` - Login form
- `src/components/AccountDropdown.tsx` - Logout functionality
- `src/components/ProtectedRoute.tsx` - Route protection
- `src/app/login/page.tsx` - Login page route
- `src/app/dashboard/page.tsx` - Dashboard page route

### Testing Plan:
1. Test login with valid credentials
2. Test login with invalid credentials
3. Test logout functionality
4. Test session persistence
5. Test protected route access
