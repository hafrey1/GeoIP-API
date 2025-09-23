const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('index', async (req, res) => {
  // 设置响应头
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const currentTime = new Date().toISOString();
  const startTime = Date.now();
  
  const apiInfo = {
    name: 'GeoIP-API',
    version: '3.0.0',
    description: 'High-performance IP and domain geolocation API service with DNS resolution',
    architecture: 'Vercel Serverless Functions',
    powered_by: 'Vercel Edge Network',
    data_source: 'IP2LOCATION-LITE-DB1',
    last_updated: currentTime,
    
    // 新增功能突出显示
    new_features: {
      domain_lookup: 'Support for domain name geolocation queries ⭐ New',
      mixed_batch: 'Mixed IP and domain batch processing ⭐ New', 
      smart_identification: 'Automatic input type detection ⭐ New',
      dns_resolution: 'Parallel DNS resolution with timeout protection ⭐ New'
    },
    
    endpoints: {
      info: {
        url: 'GET /api/index',
        description: 'API information and usage guide',
        example: 'GET /api/index'
      },
      
      health: {
        url: 'GET /api/health',
        description: 'Service health check and performance metrics',
        example: 'GET /api/health'
      },
      
      single_ip_lookup: {
        url: 'GET /api/lookup?ip={ip_address}',
        description: 'Query geolocation for a single IP address',
        example: 'GET /api/lookup?ip=8.8.8.8',
        response_time: '50-100ms'
      },
      
      single_domain_lookup: {
        url: 'GET /api/lookup?domain={domain_name}',
        description: 'Query geolocation for a single domain name ⭐ New',
        examples: [
          'GET /api/lookup?domain=google.com',
          'GET /api/lookup?domain=baidu.com',
          'GET /api/lookup?domain=cloudflare.com'
        ],
        response_time: '150-300ms (including DNS resolution)',
        note: 'Automatically resolves domain to IP address then queries geolocation'
      },
      
      batch_ip_lookup: {
        url: 'POST /api/batch',
        description: 'Traditional IP batch lookup (backward compatible)',
        content_type: 'application/json',
        body: {
          ips: [
            '8.8.8.8',
            '1.1.1.1',
            '114.114.114.114'
          ]
        },
        max_size: 500,
        response_time: '200ms-5s depending on batch size'
      },
      
      mixed_batch_lookup: {
        url: 'POST /api/batch',
        description: 'Mixed IP and domain batch lookup ⭐ New',
        content_type: 'application/json',
        body: {
          inputs: [
            '8.8.8.8',
            'google.com',
            '1.1.1.1',
            'cloudflare.com',
            'baidu.com'
          ]
        },
        max_size: 500,
        max_domains: 100,
        response_time: '500ms-8s depending on batch size and domain count',
        note: 'Supports mixed IP addresses and domain names in single request'
      }
    },
    
    features: {
      // 核心功能
      ip_geolocation: 'Precise IPv4 geolocation lookup',
      domain_geolocation: 'Domain name geolocation via DNS resolution ⭐ New',
      mixed_queries: 'Support for IP and domain mixed batch queries ⭐ New',
      smart_detection: 'Automatic input type detection (IP/domain) ⭐ New',
      
      // 性能特性
      global_cdn: 'Vercel Edge Network with worldwide distribution',
      smart_caching: '30-minute memory cache + 5-minute CDN cache',
      dns_caching: 'Intelligent DNS resolution result caching ⭐ New',
      batch_processing: 'Up to 500 inputs per batch request',
      parallel_dns: 'Parallel DNS resolution for multiple domains ⭐ New',
      high_performance: 'Binary search algorithm with pre-built indices',
      
      // 可靠性特性
      timeout_protection: 'DNS resolution timeout protection (5s/domain) ⭐ New',
      error_handling: 'Comprehensive DNS and geolocation error handling',
      cors_support: 'Complete cross-origin request support',
      monitoring: 'Built-in performance tracking and DNS success rate monitoring',
      backward_compatibility: 'Full backward compatibility with existing clients'
    },
    
    performance: {
      single_ip_query: '50-100ms average response time',
      single_domain_query: '150-300ms average (including DNS resolution) ⭐ New',
      small_batch: '200-500ms for 1-50 inputs',
      medium_batch: '800ms-2s for 50-200 inputs',
      large_batch: '2-8s for 200-500 inputs',
      dns_resolution: '50-200ms per domain (parallel processing) ⭐ New',
      dns_timeout: '5 seconds maximum per domain ⭐ New',
      memory_limit: '1024MB for batch operations',
      execution_timeout: '30s maximum execution time'
    },
    
    usage_limits: {
      max_batch_size: 500,
      max_domains_per_batch: 100,
      dns_timeout_per_domain: '5 seconds',
      rate_limiting: 'Managed by Vercel platform',
      memory_per_function: 'Up to 1024MB',
      execution_timeout: '30 seconds maximum',
      concurrent_dns_resolution: 'Unlimited (managed by system)'
    },
    
    // IP查询响应格式
    ip_response_format: {
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
      },
      cache_info: {
        ttl_seconds: 300,
        cached_at: '2025-09-22T14:00:00.000Z'
      }
    },
    
    // 域名查询响应格式 ⭐ 新增
    domain_response_format: {
      success: true,
      data: {
        'google.com': {
          input: 'google.com',
          input_type: 'domain',
          resolved_ip: '8.8.8.8',
          ip: '8.8.8.8',
          country_code: 'US',
          country_name: 'United States'
        }
      },
      stats: {
        total: 1,
        valid: 1,
        processed: 1,
        response_time_ms: 156,
        dns_resolution_time_ms: 89,
        geo_query_time_ms: 67
      },
      cache_info: {
        ttl_seconds: 300,
        cached_at: '2025-09-22T14:00:00.000Z'
      }
    },
    
    // 混合批量查询响应格式 ⭐ 新增
    mixed_batch_response_format: {
      success: true,
      data: {
        '8.8.8.8': {
          input: '8.8.8.8',
          input_type: 'ip',
          ip: '8.8.8.8',
          country_code: 'US',
          country_name: 'United States'
        },
        'google.com': {
          input: 'google.com',
          input_type: 'domain',
          resolved_ip: '8.8.8.8',
          ip: '8.8.8.8',
          country_code: 'US',
          country_name: 'United States'
        }
      },
      stats: {
        total: 2,
        valid_ips: 1,
        valid_domains: 1,
        resolved_domains: 1,
        dns_failures: 0,
        processed: 2,
        found: 2,
        response_time_ms: 445,
        dns_resolution_time_ms: 156,
        geo_query_time_ms: 234
      },
      dns_info: {
        success_rate: '100%',
        resolved: {
          'google.com': '8.8.8.8'
        },
        errors: {}
      }
    },
    
    error_handling: {
      invalid_ip: 'Returns detailed error for invalid IP format',
      invalid_domain: 'Returns detailed error for invalid domain format',
      dns_resolution_failed: 'Returns specific DNS resolution error details ⭐ New',
      ip_not_found: 'Returns error when IP not found in database',
      batch_size_exceeded: 'Returns error when batch size exceeds limits',
      domain_limit_exceeded: 'Returns error when domain count exceeds limits ⭐ New',
      timeout_protection: 'Automatic timeout handling for DNS and queries'
    },
    
    usage_examples: {
      curl_ip: 'curl "your-api-domain/api/lookup?ip=8.8.8.8"',
      curl_domain: 'curl "your-api-domain/api/lookup?domain=google.com" ⭐ New',
      curl_batch_mixed: 'curl -X POST "your-api-domain/api/batch" -H "Content-Type: application/json" -d \'{"inputs":["8.8.8.8","google.com"]}\' ⭐ New',
      curl_batch_ip: 'curl -X POST "your-api-domain/api/batch" -H "Content-Type: application/json" -d \'{"ips":["8.8.8.8","1.1.1.1"]}\''
    },
    
    links: {
      documentation: 'your-api-domain/api/index',
      health_check: 'your-api-domain/api/health',
      github_repository: 'https://github.com/hafrey1/GeoIP-API',
      vercel_platform: 'https://vercel.com',
      data_source: 'https://lite.ip2location.com'
    },
    
    support: {
      issues: 'Report issues on GitHub repository',
      feature_requests: 'Submit feature requests via GitHub Issues',
      contact: 'Contact via GitHub or project documentation',
      updates: 'Follow GitHub repository for latest updates'
    },
    
    // 系统信息
    system_info: {
      timestamp: currentTime,
      timezone: 'UTC',
      server_location: 'Vercel Edge Network',
      nodejs_version: process.version,
      platform: process.platform,
      architecture: process.arch
    }
  };
  
  // 计算响应时间
  const responseTime = Date.now() - startTime;
  apiInfo.response_time_ms = responseTime;
  
  // 🎯 格式化JSON输出 - 2空格缩进，便于阅读
  const formattedJson = JSON.stringify(apiInfo, null, 2);
  
  // 设置成功状态码并返回格式化的JSON
  res.status(200).end(formattedJson);
});
