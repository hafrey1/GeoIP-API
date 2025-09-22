/**
 * 性能追踪装饰器
 * 包装API函数以自动记录性能指标和错误日志
 * @param {string} operation - 操作名称
 * @param {Function} fn - 要包装的函数
 * @returns {Function} - 包装后的函数
 */
function trackPerformance(operation, fn) {
  return async (req, res) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // 记录请求开始
    console.log(`[${requestId}] ${operation.toUpperCase()} started`, {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      clientIP: clientIP,
      userAgent: userAgent.substring(0, 100) // 限制长度
    });
    
    try {
      // 执行原函数
      const result = await fn(req, res);
      
      // 记录成功完成
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ${operation.toUpperCase()} completed`, {
        duration: `${duration}ms`,
        success: true,
        timestamp: new Date().toISOString()
      });
      
      // 更新性能统计
      updatePerformanceStats(operation, duration, true);
      
      return result;
      
    } catch (error) {
      // 记录错误
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ${operation.toUpperCase()} failed`, {
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // 更新错误统计
      updatePerformanceStats(operation, duration, false);
      updateErrorStats(operation, error);
      
      // 重新抛出错误
      throw error;
    }
  };
}

/**
 * 生成唯一请求ID
 * @returns {string} - 唯一请求标识符
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取客户端真实IP地址
 * 考虑代理和负载均衡器的情况
 * @param {Object} req - Express请求对象
 * @returns {string} - 客户端IP地址
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

// 全局性能统计数据
const performanceStats = {
  operations: {},
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0
};

// 错误统计数据
const errorStats = {
  byOperation: {},
  byType: {},
  recentErrors: []
};

/**
 * 更新操作性能统计
 * @param {string} operation - 操作名称
 * @param {number} duration - 执行时长（毫秒）
 * @param {boolean} success - 是否成功
 */
function updatePerformanceStats(operation, duration, success) {
  if (!performanceStats.operations[operation]) {
    performanceStats.operations[operation] = {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 0,
      lastCall: null
    };
  }
  
  const stats = performanceStats.operations[operation];
  
  // 更新基本统计
  stats.count++;
  stats.totalDuration += duration;
  stats.avgDuration = Math.round(stats.totalDuration / stats.count);
  stats.minDuration = Math.min(stats.minDuration, duration);
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.lastCall = new Date().toISOString();
  
  // 更新成功率统计
  if (success) {
    stats.successCount++;
  } else {
    stats.errorCount++;
  }
  stats.successRate = Math.round((stats.successCount / stats.count) * 100);
  
  // 更新全局统计
  performanceStats.totalRequests++;
  if (!success) {
    performanceStats.totalErrors++;
  }
}

/**
 * 更新错误统计
 * @param {string} operation - 操作名称
 * @param {Error} error - 错误对象
 */
function updateErrorStats(operation, error) {
  // 按操作统计错误
  if (!errorStats.byOperation[operation]) {
    errorStats.byOperation[operation] = 0;
  }
  errorStats.byOperation[operation]++;
  
  // 按错误类型统计
  const errorType = error.constructor.name;
  if (!errorStats.byType[errorType]) {
    errorStats.byType[errorType] = 0;
  }
  errorStats.byType[errorType]++;
  
  // 记录最近的错误（保留最近50个）
  errorStats.recentErrors.unshift({
    operation: operation,
    type: errorType,
    message: error.message,
    timestamp: new Date().toISOString(),
    stack: error.stack?.split('\n').slice(0, 5).join('\n') // 只保留前5行堆栈
  });
  
  // 限制最近错误记录数量
  if (errorStats.recentErrors.length > 50) {
    errorStats.recentErrors = errorStats.recentErrors.slice(0, 50);
  }
}

/**
 * 获取性能统计报告
 * @returns {Object} - 完整的性能统计报告
 */
function getPerformanceStats() {
  const uptime = Date.now() - performanceStats.startTime;
  
  return {
    uptime: {
      milliseconds: uptime,
      seconds: Math.floor(uptime / 1000),
      minutes: Math.floor(uptime / 60000),
      hours: Math.floor(uptime / 3600000),
      formatted: formatUptime(uptime)
    },
    
    requests: {
      total: performanceStats.totalRequests,
      errors: performanceStats.totalErrors,
      success_rate: performanceStats.totalRequests > 0 
        ? Math.round(((performanceStats.totalRequests - performanceStats.totalErrors) / performanceStats.totalRequests) * 100)
        : 100,
      avg_per_minute: uptime > 60000 
        ? Math.round((performanceStats.totalRequests / (uptime / 60000)) * 100) / 100
        : 0
    },
    
    operations: performanceStats.operations,
    
    errors: {
      by_operation: errorStats.byOperation,
      by_type: errorStats.byType,
      recent_count: errorStats.recentErrors.length,
      recent_errors: errorStats.recentErrors.slice(0, 10) // 只返回最近10个
    },
    
    memory: process.memoryUsage(),
    
    system: {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    
    timestamp: new Date().toISOString()
  };
}

/**
 * 格式化运行时间
 * @param {number} uptime - 运行时间（毫秒）
 * @returns {string} - 格式化的运行时间字符串
 */
function formatUptime(uptime) {
  const seconds = Math.floor(uptime / 1000) % 60;
  const minutes = Math.floor(uptime / 60000) % 60;
  const hours = Math.floor(uptime / 3600000) % 24;
  const days = Math.floor(uptime / 86400000);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * 记录自定义指标
 * @param {string} metric - 指标名称
 * @param {number} value - 指标值
 * @param {Object} tags - 可选的标签
 */
function recordMetric(metric, value, tags = {}) {
  console.log(`[METRIC] ${metric}: ${value}`, {
    timestamp: new Date().toISOString(),
    tags: tags
  });
}

/**
 * 记录业务事件
 * @param {string} event - 事件名称
 * @param {Object} data - 事件数据
 */
function logEvent(event, data = {}) {
  console.log(`[EVENT] ${event}`, {
    timestamp: new Date().toISOString(),
    data: data
  });
}

/**
 * 性能警告检查
 * @param {string} operation - 操作名称
 * @param {number} duration - 执行时长
 */
function checkPerformanceWarnings(operation, duration) {
  const warnings = [];
  
  // 检查执行时间警告
  if (duration > 5000) {
    warnings.push(`Slow operation: ${operation} took ${duration}ms`);
  }
  
  // 检查内存使用警告
  const memUsage = process.memoryUsage();
  const memUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  if (memUsedMB > 800) {
    warnings.push(`High memory usage: ${Math.round(memUsedMB)}MB heap used`);
  }
  
  // 检查错误率警告
  const stats = performanceStats.operations[operation];
  if (stats && stats.count > 10 && stats.successRate < 90) {
    warnings.push(`Low success rate: ${operation} has ${stats.successRate}% success rate`);
  }
  
  // 输出警告
  if (warnings.length > 0) {
    console.warn('[PERFORMANCE WARNING]', warnings.join('; '));
  }
  
  return warnings;
}

/**
 * 重置统计数据
 */
function resetStats() {
  performanceStats.operations = {};
  performanceStats.totalRequests = 0;
  performanceStats.totalErrors = 0;
  performanceStats.startTime = Date.now();
  
  errorStats.byOperation = {};
  errorStats.byType = {};
  errorStats.recentErrors = [];
  
  console.log('[MONITOR] Performance statistics reset');
}

module.exports = {
  trackPerformance,
  getPerformanceStats,
  recordMetric,
  logEvent,
  checkPerformanceWarnings,
  resetStats,
  generateRequestId,
  getClientIP
};
