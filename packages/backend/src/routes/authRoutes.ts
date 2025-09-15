import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
  getSessions,
  revokeSession,
  verifyEmail
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authentication.js';
import { authRateLimiter, apiRateLimiter } from '../middleware/rateLimiter.js';
import { auditLogger } from '../middleware/auditLogger.js';

const router = Router();

// Public routes (no authentication required)
router.post('/register', 
  authRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  register
);

router.post('/login', 
  authRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  login
);

router.post('/refresh', 
  apiRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  refreshToken
);

router.post('/password-reset-request', 
  authRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  requestPasswordReset
);

router.post('/password-reset', 
  authRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  resetPassword
);

router.get('/verify-email/:token', 
  apiRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  verifyEmail
);

// Protected routes (authentication required)
router.post('/logout', 
  authenticateToken,
  apiRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  logout
);

router.post('/change-password', 
  authenticateToken,
  authRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  changePassword
);

router.get('/profile', 
  authenticateToken,
  apiRateLimiter,
  getProfile
);

router.put('/profile', 
  authenticateToken,
  apiRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  updateProfile
);

router.get('/sessions', 
  authenticateToken,
  apiRateLimiter,
  getSessions
);

router.delete('/sessions/:sessionId', 
  authenticateToken,
  apiRateLimiter,
  auditLogger({ logLevel: 'ALL' }),
  revokeSession
);

export default router;