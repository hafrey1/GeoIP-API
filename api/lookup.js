const { queryIP } = require('./_lib/database');
const { validateIP, validateDomain, identifyInput, resolveDomainToIP } = require('./_lib/ipUtils');
const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('lookup', async (req, res) => {
  // 设置响应头
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只允许GET请求
  if (req.method !== 'GET') {
    const errorResponse = {
      success: false,
      error: 'Method not allowed',
      message: '请使用GET方法查询IP地址或域名地理位置',
      allowed_methods: ['GET', 'OPTIONS'],
      usage: {
        method: 'GET',
        ip_example: '/api/lookup?ip=8.8.8.8',
        domain_example: '/api/lookup?domain=google.com',
        curl_ip: 'curl "https://your-domain.vercel.app/api/lookup?ip=8.8.8.8"',
        curl_domain: 'curl "https://your-domain.vercel.app/api/lookup?domain=google.com"'
      },
      timestamp: new Date().toISOString()
    };
    
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(405).end(formattedJson);
  }

  // 获取查询参数
  const { ip, domain } = req.query;
  const startTime = Date.now();
  const requestId = `req_${startTime}`;
  
  console.log(`[${requestId}] 开始处理查询请求 - IP: ${ip}, Domain: ${domain}`);

  // 检查是否提供了查询参数
  if (!ip && !domain) {
    const errorResponse = {
      success: false,
      error: 'Missing required parameter',
      message: '请提供ip或domain参数进行查询',
      request_id: requestId,
      usage: {
        ip_query: '/api/lookup?ip=8.8.8.8',
        domain_query: '/api/lookup?domain=google.com',
        examples: [
          'https://your-domain.vercel.app/api/lookup?ip=1.1.1.1',
          'https://your-domain.vercel.app/api/lookup?domain=cloudflare.com',
          'https://your-domain.vercel.app/api/lookup?ip=114.114.114.114',
          'https://your-domain.vercel.app/api/lookup?domain=baidu.com'
        ]
      },
      stats: {
        response_time_ms: Date.now() - startTime,
        error_occurred: true
      },
      timestamp: new Date().toISOString()
    };
    
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(400).end(formattedJson);
  }

  // 如果同时提供了ip和domain参数，优先使用ip
  if (ip && domain) {
    console.log(`[${requestId}] 同时提供了IP和域名参数，优先使用IP: ${ip}`);
  }

  try {
    let targetIP;
    let inputType;
    let resolvedFrom;
    let dnsResolutionTime = 0;
    
    if (ip) {
      // 处理IP查询
      inputType = 'ip';
      const identified = identifyInput(ip);
      
      if (identified.type === 'ip') {
        targetIP = identified.value;
        resolvedFrom = 'direct_ip';
      } else if (identified.type === 'domain') {
        // 用户在ip参数中提供了域名，自动解析
        const dnsStartTime = Date.now();
        try {
          targetIP = await resolveDomainToIP(identified.value);
          dnsResolutionTime = Date.now() - dnsStartTime;
          inputType = 'domain_as_ip';
          resolvedFrom = `dns_resolved_from_${identified.value}`;
          console.log(`[${requestId}] 从域名 ${identified.value} 解析到IP: ${targetIP} (耗时: ${dnsResolutionTime}ms)`);
        } catch (dnsError) {
          const errorResponse = {
            success: false,
            error: 'DNS resolution failed',
            message: `域名解析失败: ${dnsError.message}`,
            input: identified.value,
            input_type: 'domain',
            request_id: requestId,
            stats: {
              response_time_ms: Date.now() - startTime,
              dns_resolution_time_ms: Date.now() - dnsStartTime,
              error_occurred: true
            },
            timestamp: new Date().toISOString()
          };
          
          const formattedJson = JSON.stringify(errorResponse, null, 2);
          return res.status(400).end(formattedJson);
        }
      } else {
        const errorResponse = {
          success: false,
          error: 'Invalid input format',
          message: '请提供有效的IPv4地址或域名格式',
          input: ip,
          request_id: requestId,
          examples: {
            valid_ips: ['8.8.8.8', '1.1.1.1', '114.114.114.114'],
            valid_domains: ['google.com', 'baidu.com', 'cloudflare.com']
          },
          stats: {
            response_time_ms: Date.now() - startTime,
            error_occurred: true
          },
          timestamp: new Date().toISOString()
        };
        
        const formattedJson = JSON.stringify(errorResponse, null, 2);
        return res.status(400).end(formattedJson);
      }
    } else {
      // 处理域名查询
      inputType = 'domain';
      if (!validateDomain(domain)) {
        const errorResponse = {
          success: false,
          error: 'Invalid domain format',
          message: '请提供有效的域名格式',
          input: domain,
          request_id: requestId,
          examples: {
            valid_domains: ['google.com', 'baidu.com', 'github.com', 'stackoverflow.com']
          },
          stats: {
            response_time_ms: Date.now() - startTime,
            error_occurred: true
          },
          timestamp: new Date().toISOString()
        };
        
        const formattedJson = JSON.stringify(errorResponse, null, 2);
        return res.status(400).end(formattedJson);
      }
      
      // DNS解析域名为IP
      const dnsStartTime = Date.now();
      try {
        targetIP = await resolveDomainToIP(domain);
        dnsResolutionTime = Date.now() - dnsStartTime;
        resolvedFrom = `dns_resolved_from_${domain}`;
        console.log(`[${requestId}] 域名 ${domain} 解析为IP: ${targetIP} (耗时: ${dnsResolutionTime}ms)`);
      } catch (dnsError) {
        const errorResponse = {
          success: false,
          error: 'DNS resolution failed',
          message: `域名 ${domain} 解析失败: ${dnsError.message}`,
          input: domain,
          input_type: 'domain',
          request_id: requestId,
          suggestions: [
            '请检查域名拼写是否正确',
            '确认域名存在且可访问',
            '尝试使用其他DNS服务器'
          ],
          stats: {
            response_time_ms: Date.now() - startTime,
            dns_resolution_time_ms: Date.now() - dnsStartTime,
            error_occurred: true
          },
          timestamp: new Date().toISOString()
        };
        
        const formattedJson = JSON.stringify(errorResponse, null, 2);
        return res.status(400).end(formattedJson);
      }
    }

    // 查询IP地理位置信息
    console.log(`[${requestId}] 查询IP地理位置: ${targetIP}`);
    const queryStartTime = Date.now();
    const result = await queryIP(targetIP);
    const queryTime = Date.now() - queryStartTime;
    
    if (result) {
      const responseData = {
        success: true,
        data: {
          [ip || domain]: {
            input: ip || domain,
            input_type: inputType,
            resolved_ip: targetIP,
            resolved_from: resolvedFrom,
            ip: result.ip,
            country_code: result.country_code,
            country_name: result.country_name
          }
        },
        stats: {
          total: 1,
          valid: 1,
          processed: 1,
          response_time_ms: Date.now() - startTime,
          dns_resolution_time_ms: dnsResolutionTime,
          geo_query_time_ms: queryTime
        },
        cache_info: {
          ttl_seconds: 300,
          cached_at: new Date().toISOString()
        },
        request_id: requestId,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[${requestId}] 查询成功完成 - 总耗时: ${Date.now() - startTime}ms`);
      
      const formattedJson = JSON.stringify(responseData, null, 2);
      return res.status(200).end(formattedJson);
    } else {
      const errorResponse = {
        success: false,
        error: 'IP not found in database',
        message: `未找到IP地址 ${targetIP} 的地理位置信息`,
        input: ip || domain,
        input_type: inputType,
        resolved_ip: targetIP,
        request_id: requestId,
        stats: {
          response_time_ms: Date.now() - startTime,
          dns_resolution_time_ms: dnsResolutionTime,
          geo_query_time_ms: queryTime,
          error_occurred: true
        },
        timestamp: new Date().toISOString()
      };
      
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(404).end(formattedJson);
    }
    
  } catch (error) {
    console.error(`[${requestId}] 处理查询时发生错误:`, error);
    
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      message: '服务器处理查询时发生内部错误',
      input: ip || domain,
      request_id: requestId,
      debug: {
        error_message: error.message,
        error_stack: error.stack
      },
      stats: {
        response_time_ms: Date.now() - startTime,
        error_occurred: true
      },
      timestamp: new Date().toISOString()
    };
    
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(500).end(formattedJson);
  }
});
