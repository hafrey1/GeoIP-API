const { queryIP } = require('./_lib/database');
const { validateIP } = require('./_lib/ipUtils');
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
      message: '请使用GET方法查询IP地理位置',
      allowed_methods: ['GET', 'OPTIONS'],
      usage: {
        method: 'GET',
        url: '/api/lookup?ip=8.8.8.8',
        example: 'curl "{{283}}"'
      },
      timestamp: new Date().toISOString()
    };
    
    // 🎯 格式化JSON输出
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(405).end(formattedJson);
  }

  // 获取IP参数
  const { ip } = req.query;
  const startTime = Date.now();
  const requestId = `lookup_${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 验证IP参数
    if (!ip) {
      const errorResponse = {
        success: false,
        error: 'Missing IP parameter',
        message: '请在查询参数中提供IP地址',
        request_id: requestId,
        usage: {
          correct_format: '/api/lookup?ip=8.8.8.8',
          examples: [
            '/api/lookup?ip=8.8.8.8',
            '/api/lookup?ip=1.1.1.1',
            '/api/lookup?ip=114.114.114.114'
          ]
        },
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    // 验证IP格式
    if (!validateIP(ip)) {
      const errorResponse = {
        success: false,
        error: 'Invalid IP address format',
        message: '请提供有效的IPv4地址格式',
        provided_ip: ip,
        request_id: requestId,
        valid_format: 'IPv4 format (e.g., 192.168.1.1)',
        examples: [
          '8.8.8.8',
          '1.1.1.1', 
          '114.114.114.114',
          '192.168.1.1'
        ],
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    console.log(`Looking up IP: ${ip} (Request: ${requestId})`);
    
    // 查询IP地理位置
    const result = await queryIP(ip);
    const responseTime = Date.now() - startTime;
    
    // 构建成功响应
    const successResponse = {
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
      },
      request_id: requestId
    };
    
    console.log(`IP lookup completed: ${ip} -> ${result.country_code} (${responseTime}ms)`);
    
    // 🎯 关键修改：格式化JSON输出
    const formattedJson = JSON.stringify(successResponse, null, 2);
    res.status(200).end(formattedJson);
    
  } catch (error) {
    console.error(`Lookup error for IP ${ip}:`, error);
    
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      message: '无法查询IP地理位置，请稍后重试',
      provided_ip: ip,
      request_id: requestId,
      debug_info: {
        error_type: error.name || 'Unknown',
        error_message: error.message
      },
      stats: {
        response_time_ms: Date.now() - startTime,
        error_occurred: true
      }
    };
    
    // 🎯 关键修改：错误响应也格式化JSON
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    res.status(500).end(formattedJson);
  }
});
