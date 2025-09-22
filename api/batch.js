const { queryIPs } = require('./_lib/database');
const { validateInputs, resolveDomainToIP, chunkArray } = require('./_lib/ipUtils');
const { trackPerformance } = require('./_lib/monitor');

// 批量查询配置
const BATCH_CONFIG = {
  MAX_BATCH_SIZE: 500,
  CHUNK_SIZE: 50, // 分批处理大小
  MAX_CONCURRENT_CHUNKS: 10, // 最大并发批次
  TIMEOUT_MS: 25000, // 25秒超时
  DNS_TIMEOUT_MS: 5000, // DNS解析5秒超时
  MAX_DOMAIN_RESOLUTION: 100 // 单次最多解析100个域名
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
        body_examples: {
          mixed_query: {
            inputs: [
              '8.8.8.8',
              'google.com',
              '1.1.1.1',
              'cloudflare.com',
              '114.114.114.114',
              'baidu.com'
            ]
          },
          ip_only: {
            ips: [
              '8.8.8.8',
              '1.1.1.1',
              '114.114.114.114'
            ]
          }
        },
        curl_example: 'curl -X POST "35" -H "Content-Type: application/json" -d \'{"inputs":["8.8.8.8","google.com","1.1.1.1"]}\''
      },
      timestamp: new Date().toISOString()
    };
    
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    return res.status(405).end(formattedJson);
  }

  const startTime = Date.now();
  const requestId = `batch_${startTime}`;
  
  console.log(`[${requestId}] 开始处理批量查询请求`);

  try {
    // 解析请求体
    let requestBody;
    try {
      const bodyStr = JSON.stringify(req.body);
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      const errorResponse = {
        success: false,
        error: 'Invalid JSON format',
        message: '请求体必须是有效的JSON格式',
        request_id: requestId,
        example: {
          inputs: ['8.8.8.8', 'google.com', '1.1.1.1']
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

    // 兼容旧版本的ips参数和新版本的inputs参数
    const inputArray = requestBody.inputs || requestBody.ips || [];
    
    if (!Array.isArray(inputArray)) {
      const errorResponse = {
        success: false,
        error: 'Invalid input format',
        message: 'inputs 必须是数组格式',
        request_id: requestId,
        received_type: typeof inputArray,
        example: {
          inputs: ['8.8.8.8', 'google.com', '1.1.1.1']
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

    if (inputArray.length === 0) {
      const errorResponse = {
        success: false,
        error: 'Empty input array',
        message: '输入数组不能为空',
        request_id: requestId,
        example: {
          inputs: ['8.8.8.8', 'google.com', '1.1.1.1']
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

    if (inputArray.length > BATCH_CONFIG.MAX_BATCH_SIZE) {
      const errorResponse = {
        success: false,
        error: 'Batch size limit exceeded',
        message: `批量查询最多支持 ${BATCH_CONFIG.MAX_BATCH_SIZE} 个输入，当前: ${inputArray.length}`,
        request_id: requestId,
        limits: {
          max_batch_size: BATCH_CONFIG.MAX_BATCH_SIZE,
          current_size: inputArray.length
        },
        suggestion: `请将查询分成多个较小的批次进行`,
        stats: {
          response_time_ms: Date.now() - startTime,
          error_occurred: true
        },
        timestamp: new Date().toISOString()
      };
      
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }

    // 验证和分类输入
    const validationStartTime = Date.now();
    const validation = validateInputs(inputArray);
    const validationTime = Date.now() - validationStartTime;
    
    console.log(`[${requestId}] 输入验证完成 - IP数量: ${validation.stats.ipCount}, 域名数量: ${validation.stats.domainCount}, 无效数量: ${validation.stats.invalidCount}, 重复数量: ${validation.stats.duplicateCount}`);

    // 检查域名数量限制
    if (validation.domains.length > BATCH_CONFIG.MAX_DOMAIN_RESOLUTION) {
      const errorResponse = {
        success: false,
        error: 'Domain resolution limit exceeded',
        message: `单次批量查询最多支持解析 ${BATCH_CONFIG.MAX_DOMAIN_RESOLUTION} 个域名，当前域名数量: ${validation.domains.length}`,
        request_id: requestId,
        limits: {
          max_domains: BATCH_CONFIG.MAX_DOMAIN_RESOLUTION,
          current_domains: validation.domains.length
        },
        validation_results: {
          total_inputs: validation.stats.total,
          ips: validation.stats.ipCount,
          domains: validation.stats.domainCount,
          invalid: validation.stats.invalidCount
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

    // DNS解析所有域名
    let resolvedIPs = [...validation.ips]; // 直接复制已有的IP
    let dnsResolutions = {};
    let dnsErrors = {};
    let dnsResolutionTime = 0;
    
    if (validation.domains.length > 0) {
      console.log(`[${requestId}] 开始解析 ${validation.domains.length} 个域名`);
      const dnsStartTime = Date.now();
      
      // 并行解析所有域名
      const dnsPromises = validation.domains.map(async (domain) => {
        try {
          const resolvedIP = await Promise.race([
            resolveDomainToIP(domain),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('DNS timeout')), BATCH_CONFIG.DNS_TIMEOUT_MS)
            )
          ]);
          
          dnsResolutions[domain] = resolvedIP;
          resolvedIPs.push(resolvedIP);
          return { domain, ip: resolvedIP, success: true };
        } catch (error) {
          dnsErrors[domain] = error.message;
          return { domain, error: error.message, success: false };
        }
      });
      
      const dnsResults = await Promise.allSettled(dnsPromises);
      dnsResolutionTime = Date.now() - dnsStartTime;
      
      const successfulResolutions = dnsResults.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      console.log(`[${requestId}] DNS解析完成 - 成功: ${successfulResolutions}, 失败: ${validation.domains.length - successfulResolutions}, 耗时: ${dnsResolutionTime}ms`);
    }

    // 如果没有任何有效的IP，返回错误
    if (resolvedIPs.length === 0) {
      const errorResponse = {
        success: false,
        error: 'No valid inputs to process',
        message: '没有有效的IP地址或可解析的域名',
        request_id: requestId,
        validation_results: {
          total_inputs: validation.stats.total,
          valid_ips: validation.stats.ipCount,
          valid_domains: validation.stats.domainCount,
          dns_failures: Object.keys(dnsErrors).length,
          invalid_inputs: validation.stats.invalidCount
        },
        dns_errors: dnsErrors,
        invalid_inputs: validation.invalid,
        stats: {
          response_time_ms: Date.now() - startTime,
          validation_time_ms: validationTime,
          dns_resolution_time_ms: dnsResolutionTime,
          error_occurred: true
        },
        timestamp: new Date().toISOString()
      };
      
      const formattedJson = JSON.stringify(errorResponse, null, 2);
      return res.status(400).end(formattedJson);
    }

    // 去重IP地址
    const uniqueIPs = [...new Set(resolvedIPs)];
    console.log(`[${requestId}] 去重后待查询IP数量: ${uniqueIPs.length}`);

    // 分批并行查询IP地理位置
    const processingStartTime = Date.now();
    const chunks = chunkArray(uniqueIPs, BATCH_CONFIG.CHUNK_SIZE);
    const results = {};
    
    console.log(`[${requestId}] 开始分批查询 - 共 ${chunks.length} 个批次`);

    // 限制并发批次数量
    const semaphore = {
      current: 0,
      max: BATCH_CONFIG.MAX_CONCURRENT_CHUNKS
    };

    const processChunk = async (chunk, chunkIndex) => {
      // 等待信号量
      while (semaphore.current >= semaphore.max) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      semaphore.current++;
      
      try {
        console.log(`[${requestId}] 处理批次 ${chunkIndex + 1}/${chunks.length} - ${chunk.length} 个IP`);
        const chunkResults = await queryIPs(chunk);
        
        // 合并结果
        Object.assign(results, chunkResults);
        
        return chunkResults;
      } finally {
        semaphore.current--;
      }
    };

    // 并行处理所有批次
    const chunkPromises = chunks.map(processChunk);
    await Promise.all(chunkPromises);
    
    const processingTime = Date.now() - processingStartTime;
    console.log(`[${requestId}] 批量查询完成 - 耗时: ${processingTime}ms`);

    // 构建响应数据，包含原始输入的映射
    const responseData = {};
    const stats = {
      total: validation.stats.total,
      valid_ips: validation.stats.ipCount,
      valid_domains: validation.stats.domainCount,
      resolved_domains: Object.keys(dnsResolutions).length,
      dns_failures: Object.keys(dnsErrors).length,
      invalid: validation.stats.invalidCount,
      duplicates: validation.stats.duplicateCount,
      processed: 0,
      found: 0
    };

    // 处理IP输入
    validation.ips.forEach(ip => {
      const result = results[ip];
      if (result) {
        responseData[ip] = {
          input: ip,
          input_type: 'ip',
          ip: result.ip,
          country_code: result.country_code,
          country_name: result.country_name
        };
        stats.processed++;
        stats.found++;
      } else {
        responseData[ip] = {
          input: ip,
          input_type: 'ip',
          ip: ip,
          country_code: null,
          country_name: null,
          error: 'IP not found in database'
        };
        stats.processed++;
      }
    });

    // 处理域名输入
    validation.domains.forEach(domain => {
      if (dnsResolutions[domain]) {
        const resolvedIP = dnsResolutions[domain];
        const result = results[resolvedIP];
        
        if (result) {
          responseData[domain] = {
            input: domain,
            input_type: 'domain',
            resolved_ip: resolvedIP,
            ip: result.ip,
            country_code: result.country_code,
            country_name: result.country_name
          };
          stats.found++;
        } else {
          responseData[domain] = {
            input: domain,
            input_type: 'domain',
            resolved_ip: resolvedIP,
            ip: resolvedIP,
            country_code: null,
            country_name: null,
            error: 'Resolved IP not found in database'
          };
        }
        stats.processed++;
      } else {
        responseData[domain] = {
          input: domain,
          input_type: 'domain',
          resolved_ip: null,
          error: dnsErrors[domain] || 'DNS resolution failed'
        };
      }
    });

    // 生成性能建议
    const totalTime = Date.now() - startTime;
    const suggestions = [];
    
    if (totalTime > 10000) {
      suggestions.push('查询时间较长，建议减少批量大小或分多次查询');
    }
    if (validation.stats.domainCount > 50) {
      suggestions.push('域名数量较多，DNS解析可能影响性能，建议预先解析域名');
    }
    if (validation.stats.duplicateCount > 0) {
      suggestions.push('输入中包含重复项，建议去重后再查询');
    }
    if (validation.stats.invalidCount > 0) {
      suggestions.push('输入中包含无效格式，请检查IP地址和域名格式');
    }

    const finalResponse = {
      success: true,
      data: responseData,
      stats: {
        ...stats,
        unique_ips_processed: uniqueIPs.length,
        response_time_ms: totalTime,
        validation_time_ms: validationTime,
        dns_resolution_time_ms: dnsResolutionTime,
        geo_query_time_ms: processingTime,
        avg_time_per_input: Math.round(totalTime / validation.stats.total),
        throughput_per_second: Math.round(validation.stats.total / (totalTime / 1000))
      },
      dns_info: {
        resolved: dnsResolutions,
        errors: dnsErrors,
        success_rate: validation.domains.length > 0 ? 
          Math.round((Object.keys(dnsResolutions).length / validation.domains.length) * 100) + '%' : 'N/A'
      },
      validation_results: {
        invalid: validation.invalid,
        duplicates: validation.duplicates
      },
      performance_warnings: suggestions,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    console.log(`[${requestId}] 批量查询成功完成 - 总耗时: ${totalTime}ms, 处理数量: ${stats.processed}`);
    
    const formattedJson = JSON.stringify(finalResponse, null, 2);
    return res.status(200).end(formattedJson);

  } catch (error) {
    console.error(`[${requestId}] 批量查询处理错误:`, error);
    
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      message: '批量查询处理时发生内部错误',
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
