// Simple in-memory rate limiter
const rateLimitStore = new Map();

// Rate limit configurations
const RATE_LIMITS = {
    'submit-homework': { requests: 10, window: 60000 }, // 10 файлов в минуту
    'add-homework': { requests: 20, window: 60000 },    // 20 заданий в минуту
    'register': { requests: 5, window: 300000 },        // 5 регистраций в 5 минут
    'default': { requests: 100, window: 60000 }         // 100 запросов в минуту по умолчанию
};

function getRateLimit(endpoint) {
    return RATE_LIMITS[endpoint] || RATE_LIMITS.default;
}

function checkRateLimit(identifier, endpoint = 'default') {
    const limit = getRateLimit(endpoint);
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();
    
    // Get or create user's request history
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, []);
    }
    
    const requests = rateLimitStore.get(key);
    
    // Remove old requests outside the time window
    const validRequests = requests.filter(time => now - time < limit.window);
    
    // Check if limit exceeded
    if (validRequests.length >= limit.requests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: Math.min(...validRequests) + limit.window
        };
    }
    
    // Add current request
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);
    
    return {
        allowed: true,
        remaining: limit.requests - validRequests.length,
        resetTime: now + limit.window
    };
}

// Clean up old entries periodically (simple cleanup)
setInterval(() => {
    const now = Date.now();
    for (const [key, requests] of rateLimitStore.entries()) {
        const validRequests = requests.filter(time => now - time < 300000); // Keep 5 minutes
        if (validRequests.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, validRequests);
        }
    }
}, 300000); // Clean every 5 minutes

module.exports = { checkRateLimit };
