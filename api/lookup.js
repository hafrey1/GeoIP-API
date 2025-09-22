const { queryIP } = require('./_lib/database');
const { validateIP } = require('./_lib/ipUtils');
const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('lookup', async (req, res) => {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只允许GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowed_methods: ['GET', 'OPTIONS']
    });
  }

  // 获取IP参数
  const { ip } = req.query;
  const startTime = Date.now();

  // 验证IP参数
  if (!ip) {
    return res.status(400).json({
      success: false,
      error: 'IP address is required',
      usage: 'GET /api/lookup?ip=8.8.8.8'
    });
  }

  // 验证IP格式
  if (!validateIP(ip)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IP address format',
      provided: ip,
      expected: 'Valid IPv4 address (e.g., 8.8.8.8)'
    });
  }

  try {
    console.log(`Looking up IP: ${ip}`);
    
    // 查询IP地理位置
    const result = await queryIP(ip);
    const responseTime = Date.now() - startTime;
    
    // 设置缓存头部（5分钟缓存）
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    // 返回成功结果
    res.status(200).json({
      success: true,
      data: {
        [ip]: result
      },
      stats: {
        total: 1,
        valid: 1,
        processed: 1,
        response_time_ms: responseTime
      },
      cache_info: {
        ttl_seconds: 300,
        cached_at: new Date().toISOString()
      }
    });
    
    console.log(`Lookup completed for ${ip} in ${responseTime}ms`);
    
  } catch (error) {
    console.error('Lookup error:', error);
    
    const responseTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to query IP geolocation',
      request_id: `lookup_${Date.now()}`,
      stats: {
        response_time_ms: responseTime,
        error_occurred: true
      }
    });
  }
});
