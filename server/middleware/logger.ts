/**
 * ===============================================
 * REQUEST LOGGING MIDDLEWARE
 * ===============================================
 * Logs API requests for debugging and monitoring
 */

import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Skip logging for health checks and static assets
  const skipPaths = ['/api/health', '/favicon.ico'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }

  // Log request
  console.log(`🔄 ${req.method} ${req.path}`, {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    ...(Object.keys(req.body).length > 0 && { 
      body: sanitizeBody(req.body) 
    })
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? '🔴' : 
                       res.statusCode >= 300 ? '🟡' : '🟢';
    
    console.log(`${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    
    return originalJson.call(this, body);
  };

  next();
};

// Remove sensitive data from logged request bodies
const sanitizeBody = (body: any): any => {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

export { requestLogger as logger };