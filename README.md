# FlowMarine

A comprehensive maritime procurement workflow platform designed for shipping companies managing multiple vessels. FlowMarine automates the complete procurement lifecycle from vessel requisitions to supplier payments, featuring real-time tracking, configurable approval workflows, and maritime-specific capabilities.

## Features

- **Maritime-Specific Procurement**: IMPA/ISSA catalog integration, vessel compatibility checking
- **Advanced Approval Workflows**: Configurable multi-level approvals with emergency procedures
- **Offline Capabilities**: Mobile-first design with offline support for vessel operations
- **Real-time Tracking**: WebSocket-based notifications and delivery tracking
- **Multi-Currency Support**: Global procurement with real-time exchange rates
- **Comprehensive Audit**: Full audit trails for maritime compliance (SOLAS, MARPOL, ISM)
- **Vendor Management**: Automated RFQ generation and vendor scoring
- **Financial Integration**: Three-way matching and automated payment processing

## Tech Stack

### Frontend
- React 18 with TypeScript
- Redux Toolkit for state management
- Tailwind CSS for styling
- Vite for build tooling
- Progressive Web App (PWA) capabilities

### Backend
- Node.js with Express and TypeScript
- PostgreSQL with Prisma ORM
- Redis for caching and sessions
- JWT authentication with refresh tokens
- Socket.io for real-time communication

### Infrastructure
- Docker for development environment
- Comprehensive testing with Vitest
- ESLint and Prettier for code quality

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd flowmarine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   cp packages/backend/.env.example packages/backend/.env
   cp packages/frontend/.env.example packages/frontend/.env
   ```

4. Start the development environment:
   ```bash
   # Start Docker services (PostgreSQL and Redis)
   npm run docker:up
   
   # Run database migrations (after Prisma setup)
   npm run db:migrate
   
   # Start development servers
   npm run dev
   ```

### Development Commands

```bash
# Start all services
npm run dev

# Start individual services
npm run dev:frontend  # Frontend only (http://localhost:5173)
npm run dev:backend   # Backend only (http://localhost:3001)

# Database operations
npm run db:migrate    # Run database migrations
npm run db:seed       # Seed development data
npm run db:studio     # Open Prisma Studio

# Testing
npm run test          # Run all tests
npm run test:coverage # Run tests with coverage

# Code quality
npm run lint          # Lint all packages
npm run format        # Format code with Prettier

# Docker operations
npm run docker:up     # Start PostgreSQL and Redis
npm run docker:down   # Stop Docker services
```

## Project Structure

```
flowmarine/
├── packages/
│   ├── frontend/          # React frontend application
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── store/         # Redux store and slices
│   │   │   ├── utils/         # Utility functions
│   │   │   └── types/         # TypeScript type definitions
│   │   └── public/            # Static assets
│   └── backend/           # Node.js backend application
│       ├── src/
│       │   ├── controllers/   # Route controllers
│       │   ├── middleware/    # Express middleware
│       │   ├── services/      # Business logic services
│       │   ├── models/        # Data models
│       │   ├── utils/         # Utility functions
│       │   └── config/        # Configuration files
│       └── prisma/            # Database schema and migrations
├── docker/                # Docker configuration files
└── docs/                  # Documentation
```

## Environment Variables

### Backend (.env)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `SMTP_*`: Email configuration
- `PORT`: Server port (default: 3001)

### Frontend (.env)
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket server URL
- `VITE_ENABLE_OFFLINE_MODE`: Enable offline capabilities

## Security Features

- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Vessel-specific access validation
- Rate limiting and IP restrictions
- Field-level encryption for sensitive data
- Comprehensive audit logging
- Emergency access procedures for maritime operations

## Maritime Compliance

FlowMarine is designed to support maritime regulatory compliance:

- **SOLAS**: Safety equipment procurement tracking
- **MARPOL**: Environmental compliance reporting
- **ISM**: Safety management system integration
- **Audit Trails**: Complete transaction history with user accountability

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team or create an issue in the repository.