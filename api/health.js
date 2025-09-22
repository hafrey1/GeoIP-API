const fs = require('fs');
const path = require('path');
const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 检查数据文件是否存在
    const csvPath = path.join(process.cwd(), 'data', 'IP2LOCATION-LITE-DB1.CSV');
    const indexPath = path.join(process.cwd(), 'data', 'ip-ranges.json');
    
    const csvExists = fs.existsSync(csvPath);
    const indexExists = fs.existsSync(indexPath);
    
    // 获取文件信息
    let csvStats = null;
    let indexStats = null;
    
    if (csvExists) {
      csvStats = fs.statSync(csvPath);
    }
    
    if (indexExists) {
      indexStats = fs.statSync(indexPath);
    }
    
    // 检查内存使用情况
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };
    
    // 计算响应时间
    const responseTime = Date.now() - startTime;
    
    // 确定整体健康状态
    const isHealthy = csvExists && memUsageMB.heapUsed < 900; // 预留124MB缓冲区
    const status = isHealthy ? 'healthy' : 'warning';
    
    // 准备详细的健康报告
    const healthReport = {
      status: status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      response_time_ms: responseTime,
      
      service: {
        name: 'GeoIP-API Vercel',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      
      data_files: {
        csv_file: {
          exists: csvExists,
          path: 'data/IP2LOCATION-LITE-DB1.CSV',
          size_mb: csvExists ? Math.round(csvStats.size / 1024 / 1024 * 100) / 100 : 0,
          modified: csvExists ? csvStats.mtime.toISOString() : null
        },
        index_file: {
          exists: indexExists,
          path: 'data/ip-ranges.json',
          size_mb: indexExists ? Math.round(indexStats.size / 1024 / 1024 * 100) / 100 : 0,
          modified: indexExists ? indexStats.mtime.toISOString() : null,
          status: indexExists ? 'optimized' : 'missing - run build script'
        }
      },
      
      memory: {
        limit_mb: 1024,
        usage: memUsageMB,
        health_status: memUsageMB.heapUsed < 900 ? 'good' : 'warning'
      },
      
      performance: {
        cache_status: 'memory_cache_active',
        estimated_capacity: {
          single_queries_per_second: '20-50',
          batch_queries_per_minute: '5-10 (depending on size)'
        }
      },
      
      endpoints: {
        available: [
          'GET /api/index',
          'GET /api/health', 
          'GET /api/lookup',
          'POST /api/batch'
        ],
        total_count: 4
      },
      
      checks: {
        data_file_available: csvExists,
        index_file_available: indexExists,
        memory_within_limits: memUsageMB.heapUsed < 900,
        response_time_acceptable: responseTime < 1000
      }
    };
    
    // 添加警告信息
    const warnings = [];
    
    if (!csvExists) {
      warnings.push('CSV data file is missing');
    }
    
    if (!indexExists) {
      warnings.push('Optimized index file is missing - run build script');
    }
    
    if (memUsageMB.heapUsed > 800) {
      warnings.push('Memory usage is high');
    }
    
    if (responseTime > 500) {
      warnings.push('Response time is slower than expected');
    }
    
    if (warnings.length > 0) {
      healthReport.warnings = warnings;
    }
    
    // 设置适当的HTTP状态码
    const httpStatus = isHealthy ? 200 : 503;
    
    res.status(httpStatus).json(healthReport);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check failed',
        details: error.message
      },
      service: {
        name: 'GeoIP-API Vercel',
        version: '2.0.0'
      }
    });
  }
});
