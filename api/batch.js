const { queryIPs } = require('./_lib/database');
const { validateIP, chunkArray } = require('./_lib/ipUtils');
const { trackPerformance } = require('./_lib/monitor');

// 批量查询配置
const BATCH_CONFIG = {
  MAX_BATCH_SIZE: 500,
  CHUNK_SIZE: 50, // 分批处理大小
  MAX_CONCURRENT_CHUNKS: 10 // 最大并发批次
};

module.exports = trackPerformance('batch', async (req, res) => {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowed_methods: ['POST', 'OPTIONS'],
      usage: 'POST /api/batch with JSON body: {"ips": ["8.8.8.8", "1.1.1.1"]}'
    });
  }

  const startTime = Date.now();
  let validationTime = 0;
  let processingTime = 0;

  try {
    // 解析请求体
    const { ips } = req.body;

    // 验证请求体
    if (!ips) {
      return res.status(400).json({
        success: false,
        error: 'IPs array is required',
        usage: {
          method: 'POST',
          url: '/api/batch',
          body: {
            ips: ['8.8.8.8', '1.1.1.1', '114.114.114.114']
          }
        }
      });
    }

    if (!Array.isArray(ips)) {
      return res.status(400).json({
        success: false,
        error: 'IPs must be an array',
        provided_type: typeof ips,
        expected_type: 'array'
      });
    }

    // 检查批量大小限制
    if (ips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IPs array cannot be empty',
        min_size: 1,
        max_size: BATCH_CONFIG.MAX_BATCH_SIZE
      });
    }

    if (ips.length > BATCH_CONFIG.MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${BATCH_CONFIG.MAX_BATCH_SIZE} IPs allowed per batch request`,
        provided_count: ips.length,
        max_allowed: BATCH_CONFIG.MAX_BATCH_SIZE,
        suggestion: 'Split your request into smaller batches or use multiple requests'
      });
    }

    console.log(`Processing batch request with ${ips.length} IPs`);

    // IP验证阶段
    const validationStart = Date.now();
    const validIPs = [];
    const invalidIPs = [];
    const duplicateIPs = new Set();
    const seenIPs = new Set();

    ips.forEach(ip => {
      if (typeof ip !== 'string') {
        invalidIPs.push({ ip, reason: 'Not a string' });
        return;
      }

      if (seenIPs.has(ip)) {
        duplicateIPs.add(ip);
        return;
      }
      seenIPs.add(ip);

      if (validateIP(ip)) {
        validIPs.push(ip);
      } else {
        invalidIPs.push({ ip, reason: 'Invalid IPv4 format' });
      }
    });

    validationTime = Date.now() - validationStart;

    // 如果没有有效的IP地址
    if (validIPs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid IP addresses provided',
        validation: {
          total: ips.length,
          valid: 0,
          invalid: invalidIPs.length,
          duplicates: duplicateIPs.size
        },
        invalid_ips: invalidIPs.slice(0, 10), // 只显示前10个错误
        suggestion: 'Please provide valid IPv4 addresses'
      });
    }

    // 批量处理阶段
    const processingStart = Date.now();
    
    // 将IP分成小批次并发处理以提高性能
    const chunks = chunkArray(validIPs, BATCH_CONFIG.CHUNK_SIZE);
    const results = {};
    
    console.log(`Split ${validIPs.length} IPs into ${chunks.length} chunks`);
    
    // 限制并发数量以避免内存溢出
    const concurrentChunks = chunks.slice(0, BATCH_CONFIG.MAX_CONCURRENT_CHUNKS);
    const remainingChunks = chunks.slice(BATCH_CONFIG.MAX_CONCURRENT_CHUNKS);
    
    // 处理并发批次
    const processChunk = async (chunk) => {
      const chunkResults = await queryIPs(chunk);
      return chunkResults;
    };
    
    // 处理初始并发批次
    let chunkResults = await Promise.all(concurrentChunks.map(processChunk));
    
    // 合并结果
    chunkResults.forEach(chunkResult => {
      Object.assign(results, chunkResult);
    });
    
    // 如果有剩余批次，继续处理（避免超时）
    if (remainingChunks.length > 0) {
      console.log(`Processing ${remainingChunks.length} remaining chunks`);
      
      for (const chunk of remainingChunks) {
        const chunkResult = await processChunk(chunk);
        Object.assign(results, chunkResult);
        
        // 检查是否接近超时限制（25秒，留5秒缓冲）
        if (Date.now() - startTime > 25000) {
          console.log('Approaching timeout limit, stopping processing');
          break;
        }
      }
    }
    
    processingTime = Date.now() - processingStart;
    const totalTime = Date.now() - startTime;

    // 设置适当的缓存头部（较短缓存时间）
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    // 准备响应数据
    const responseData = {
      success: true,
      data: results,
      stats: {
        total_requested: ips.length,
        unique_ips: seenIPs.size,
        valid_ips: validIPs.length,
        invalid_ips: invalidIPs.length,
        duplicate_ips: duplicateIPs.size,
        processed: Object.keys(results).length,
        response_time_ms: totalTime,
        validation_time_ms: validationTime,
        processing_time_ms: processingTime
      },
      performance: {
        chunks_used: Math.min(chunks.length, BATCH_CONFIG.MAX_CONCURRENT_CHUNKS + remainingChunks.length),
        chunk_size: BATCH_CONFIG.CHUNK_SIZE,
        avg_time_per_ip: Math.round(processingTime / validIPs.length)
      }
    };
    
    // 添加警告和额外信息
    const warnings = [];
    
    if (invalidIPs.length > 0) {
      responseData.invalid_ips = invalidIPs.slice(0, 5); // 只返回前5个
      warnings.push(`${invalidIPs.length} invalid IP addresses were skipped`);
    }
    
    if (duplicateIPs.size > 0) {
      responseData.duplicate_ips = Array.from(duplicateIPs).slice(0, 5);
      warnings.push(`${duplicateIPs.size} duplicate IP addresses were removed`);
    }
    
    if (totalTime > 20000) {
      warnings.push('Request took longer than expected, consider smaller batch sizes');
    }
    
    if (warnings.length > 0) {
      responseData.warnings = warnings;
    }
    
    // 返回结果
    res.status(200).json(responseData);
    
    console.log(`Batch completed: ${Object.keys(results).length}/${validIPs.length} IPs in ${totalTime}ms`);
    
  } catch (error) {
    console.error('Batch processing error:', error);
    
    const totalTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process batch IP lookup',
      request_id: `batch_${Date.now()}`,
      stats: {
        response_time_ms: totalTime,
        error_occurred: true,
        error_stage: processingTime > 0 ? 'processing' : 'validation'
      }
    });
  }
});
