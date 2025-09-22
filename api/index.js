const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('index', async (req, res) => {
  // 设置响应头
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  
  const apiInfo = {
    name: 'GeoIP-API',
    version: '2.0.0',
    description: 'High-performance IP geolocation API service optimized for Vercel',
    architecture: 'Serverless Functions',
    powered_by: 'Vercel Edge Network',
    data_source: 'IP2LOCATION-LITE-DB1',
    
    endpoints: {
      info: {
        url: 'GET /',
        description: 'API information and usage guide'
      },
      health: {
        url: 'GET /api/health',
        description: 'Service health check and performance metrics'
      },
      single_lookup: {
        url: 'GET /api/lookup?ip={ip_address}',
        description: 'Query geolocation for a single IP address',
        example: 'GET /api/lookup?ip=8.8.8.8'
      },
      batch_lookup: {
        url: 'POST /api/batch',
        description: 'Query geolocation for multiple IP addresses (max 500)',
        content_type: 'application/json',
        body: {
          ips: ['8.8.8.8', '1.1.1.1', '114.114.114.114']
        }
      }
    },
    
    features: {
      global_cdn: 'Vercel Edge Network with worldwide distribution',
      smart_caching: '30-minute memory cache with intelligent invalidation',
      batch_processing: 'Up to 500 IPs per batch request',
      high_performance: 'Binary search algorithm with pre-built indices',
      cors_support: 'Complete cross-origin request support',
      monitoring: 'Built-in performance tracking and error logging'
    },
    
    performance: {
      single_query: '50-100ms average response time',
      small_batch: '200ms for 1-50 IPs',
      medium_batch: '800ms for 50-200 IPs', 
      large_batch: '2-5s for 200-500 IPs',
      memory_limit: '1024MB for batch operations',
      timeout_limit: '30s maximum execution time'
    },
    
    usage_limits: {
      max_batch_size: 500,
      rate_limiting: 'Managed by Vercel platform',
      memory_per_function: 'Up to 1024MB',
      execution_timeout: '30 seconds maximum'
    },
    
    response_format: {
      success: true,
      data: {
        '8.8.8.8': {
          ip: '8.8.8.8',
          country_code: 'US',
          country_name: 'United States'
        }
      },
      stats: {
        total: 1,
        valid: 1,
        processed: 1,
        response_time_ms: 45
      }
    },
    
    links: {
      documentation: 'https://github.com/hafrey/geoip-api-vercel',
      health_check: '/api/health',
      example_single: '/api/lookup?ip=8.8.8.8',
      source_code: 'https://github.com/hafrey/geoip-api-vercel'
    },
    
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  
  res.status(200).json(apiInfo);
});
