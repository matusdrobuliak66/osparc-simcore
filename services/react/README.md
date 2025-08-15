# oSPARC Simcore Frontend

A modern React frontend application for managing oSPARC projects, built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Dashboard View**: Clean, modern interface displaying all your projects
- **Project Management**: View, create, edit, and delete projects
- **Search & Filtering**: Powerful search and filtering capabilities including:
  - Search by project name, description, or owner
  - Filter by project type (user projects, templates)
  - Filter by project status
  - Filter by tags and classifiers
  - Filter by owner and date range
- **Account Management**: User profile management with account dropdown
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Technology Stack

- **Framework**: Next.js 15.4.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Linting**: ESLint with Next.js configuration

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Main dashboard page
├── components/            # Reusable UI components
│   ├── Header.tsx         # Navigation header with search and user menu
│   ├── ProjectCard.tsx    # Individual project card component
│   └── DashboardFilters.tsx # Filter controls component
├── lib/                   # Utility libraries
│   └── api.ts            # API client for backend communication
└── types/                 # TypeScript type definitions
    └── api.ts            # API response types based on OpenAPI spec
```

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm, yarn, pnpm, or bun

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Update environment variables:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API Integration

The application integrates with the oSPARC backend API. Key endpoints used:

- `GET /v0/projects` - List projects with filtering and search
- `GET /v0/projects/{project_id}` - Get specific project details
- `POST /v0/projects` - Create new project
- `PUT /v0/projects/{project_id}` - Update project
- `DELETE /v0/projects/{project_id}` - Delete project
- `GET /v0/me` - Get user profile
- `PUT /v0/me` - Update user profile

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Base URL for the oSPARC backend API

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Features in Detail

### Dashboard
- Grid and list view modes
- Project cards showing thumbnail, status, owner, and metadata
- Real-time search with debouncing
- Responsive layout

### Filtering & Search
- Multi-level filtering system
- Search across project names, descriptions, and owners
- Status-based filtering
- Tag and classifier filtering
- Date range filtering
- Clear all filters functionality

### User Management
- User profile display with initials avatar
- Account dropdown menu
- Profile and settings access
- Logout functionality

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is part of the oSPARC platform. See the main repository for license information.
