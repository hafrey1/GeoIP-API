const { queryIPs } = require('./_lib/database');
const { validateIP, chunkArray } = require('./_lib/ipUtils');
const { trackPerformance } = require('./_lib/monitor');

// 批量查询配置
const BATCH_CONFIG = {
  MAX_BATCH_SIZE: 500,
  CHUNK_SIZE: 50, // 分批处理大小
  MAX_CONCURRENT_CHUNKS: 10, // 最大并发批次
  TIMEOUT_MS: 25000 // 25秒超时
};

module.exports = trackPerformance('batch', async (req, res) => {
  // 设置响应头
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache'); // 批量查询不缓存
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只允许POST请求
  if (req.method !== 'POST') {
    const errorResponse = {
      success: false,
      error: 'Method not allowed',
      message: '批量查询请使用POST方法',
      allowed_methods: ['POST', 'OPTIONS'],
      usage: {
        method: 'POST',
        url: '/api/batch',
        content_type: 'application/json',
        body: {
          ips: [
            '8.8.8.8',
            '1.1.1.1',
            '114.114.114.114'
          ]
        },
        example: 'curl -X POST "284" -H "Content-Type: application/json" -d \'{"ips":["8.8.8.8","1.1.1.1"]}\''
      },
      timestamp: new Date().toISOString()
    };
    
    // 🎯 格式化JSON输出
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(405).end(formattedJson);
  }

  const startTime = Date.now();
  const requestId = `batch_${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 解析请求体
    let requestBody;
    try {
      // Vercel会自动解析JSON，但我们需要处理可能的异常
      requestBody = req.body;
      if (!requestBody) {
        throw new Error('Empty request body');
      }
    } catch (parseError) {
      const errorResponse = {
        success: false,
        error: 'Invalid JSON format',
        message: '请提供有效的JSON格式请求体',
        request_id: requestId,
        expected_format: {
          ips: [
            '8.8.8.8',
            '1.1.1.1',
            '114.114.114.114'
          ]
        },
        parse_error: parseError.message,
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    // 验证请求体结构
    if (!requestBody || !requestBody.ips) {
      const errorResponse = {
        success: false,
        error: 'Missing ips array',
        message: '请求体中必须包含ips数组',
        request_id: requestId,
        received: requestBody,
        expected_format: {
          ips: [
            '8.8.8.8',
            '1.1.1.1',
            '114.114.114.114'
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
    
    const { ips } = requestBody;
    
    // 验证ips是数组
    if (!Array.isArray(ips)) {
      const errorResponse = {
        success: false,
        error: 'Invalid ips format',
        message: 'ips必须是数组格式',
        request_id: requestId,
        received_type: typeof ips,
        expected_type: 'array',
        example: {
          ips: ['8.8.8.8', '1.1.1.1']
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
    
    // 验证批量大小
    if (ips.length === 0) {
      const errorResponse = {
        success: false,
        error: 'Empty IP array',
        message: 'IP数组不能为空',
        request_id: requestId,
        min_ips: 1,
        max_ips: BATCH_CONFIG.MAX_BATCH_SIZE,
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    if (ips.length > BATCH_CONFIG.MAX_BATCH_SIZE) {
      const errorResponse = {
        success: false,
        error: 'Batch size too large',
        message: `单次批量查询最多支持${BATCH_CONFIG.MAX_BATCH_SIZE}个IP地址`,
        request_id: requestId,
        received_count: ips.length,
        max_allowed: BATCH_CONFIG.MAX_BATCH_SIZE,
        suggestion: `请将IP地址分成${Math.ceil(ips.length / BATCH_CONFIG.MAX_BATCH_SIZE)}个批次查询`,
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    // 验证和清理IP地址
    let validIPs = [];
    let invalidIPs = [];
    let duplicateIPs = [];
    const seenIPs = new Set();
    
    const validationStartTime = Date.now();
    
    ips.forEach((ip, index) => {
      // 类型检查
      if (typeof ip !== 'string') {
        invalidIPs.push({
          index,
          value: ip,
          reason: `Expected string, got ${typeof ip}`
        });
        return;
      }
      
      // 去除空白符
      const cleanIP = ip.trim();
      
      // 检查重复
      if (seenIPs.has(cleanIP)) {
        duplicateIPs.push({
          index,
          ip: cleanIP,
          first_seen: Array.from(seenIPs.keys()).indexOf(cleanIP)
        });
        return;
      }
      
      // 验证IP格式
      if (!validateIP(cleanIP)) {
        invalidIPs.push({
          index,
          value: cleanIP,
          reason: 'Invalid IPv4 format'
        });
        return;
      }
      
      seenIPs.add(cleanIP);
      validIPs.push(cleanIP);
    });
    
    const validationTime = Date.now() - validationStartTime;
    
    // 如果没有有效的IP
    if (validIPs.length === 0) {
      const errorResponse = {
        success: false,
        error: 'No valid IP addresses',
        message: '请求中没有找到有效的IP地址',
        request_id: requestId,
        validation_results: {
          total_submitted: ips.length,
          valid_count: validIPs.length,
          invalid_count: invalidIPs.length,
          duplicate_count: duplicateIPs.length,
          invalid_ips: invalidIPs,
          duplicate_ips: duplicateIPs
        },
        stats: {
          validation_time_ms: validationTime,
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        }
      };
      
      // 🎯 格式化JSON输出
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }
    
    console.log(`Batch lookup started: ${validIPs.length} IPs (Request: ${requestId})`);
    
    // 执行批量查询
    const queryStartTime = Date.now();
    const results = await queryIPs(validIPs);
    const queryTime = Date.now() - queryStartTime;
    const totalTime = Date.now() - startTime;
    
    // 构建成功响应
    const successResponse = {
      success: true,
      data: results,
      stats: {
        total: ips.length,
        valid: validIPs.length,
        invalid: invalidIPs.length,
        duplicates: duplicateIPs.length,
        processed: validIPs.length,
        response_time_ms: totalTime
      },
      performance: {
        validation_time_ms: validationTime,
        query_time_ms: queryTime,
        average_per_ip_ms: Math.round(queryTime / validIPs.length * 100) / 100,
        throughput_ips_per_second: Math.round(validIPs.length / (queryTime / 1000))
      },
      validation_details: invalidIPs.length > 0 || duplicateIPs.length > 0 ? {
        invalid_ips: invalidIPs.slice(0, 10), // 只显示前10个
        duplicate_ips: duplicateIPs.slice(0, 10) // 只显示前10个
      } : undefined,
      warnings: [
        ...(invalidIPs.length > 0 ? [`${invalidIPs.length} invalid IP addresses were skipped`] : []),
        ...(duplicateIPs.length > 0 ? [`${duplicateIPs.length} duplicate IP addresses were removed`] : []),
        ...(totalTime > 10000 ? ['Query took longer than 10 seconds - consider reducing batch size'] : []),
        ...(validIPs.length > 200 ? ['Large batch size may affect performance - consider splitting into smaller batches'] : [])
      ],
      request_id: requestId,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Batch lookup completed: ${validIPs.length} IPs in ${totalTime}ms (${Math.round(validIPs.length / (totalTime / 1000))} IPs/sec)`);
    
    // 🎯 关键修改：格式化JSON输出
    const formattedJson = JSON.stringify(successResponse, null, 2);
    res.status(200).end(formattedJson);
    
  } catch (error) {
    console.error(`Batch lookup error:`, error);
    
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      message: '批量查询处理失败，请稍后重试',
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
