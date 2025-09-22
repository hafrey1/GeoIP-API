const fs = require('fs');
const path = require('path');
const { trackPerformance } = require('./_lib/monitor');

module.exports = trackPerformance('health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 设置响应头
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // 系统信息
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // 检查数据文件状态
    const csvPath = path.join(process.cwd(), 'data', 'IP2LOCATION-LITE-DB1.CSV');
    const indexPath = path.join(process.cwd(), 'data', 'ip-ranges.json');
    
    let csvStatus = { exists: false, size: 0, modified: null };
    let indexStatus = { exists: false, size: 0, modified: null };
    
    try {
      if (fs.existsSync(csvPath)) {
        const csvStat = fs.statSync(csvPath);
        csvStatus = {
          exists: true,
          size: csvStat.size,
          modified: csvStat.mtime.toISOString(),
          size_mb: Math.round(csvStat.size / 1024 / 1024 * 100) / 100
        };
      }
    } catch (error) {
      csvStatus.error = error.message;
    }
    
    try {
      if (fs.existsSync(indexPath)) {
        const indexStat = fs.statSync(indexPath);
        indexStatus = {
          exists: true,
          size: indexStat.size,
          modified: indexStat.mtime.toISOString(),
          size_mb: Math.round(indexStat.size / 1024 / 1024 * 100) / 100
        };
      }
    } catch (error) {
      indexStatus.error = error.message;
    }
    
    // 计算健康分数
    let healthScore = 100;
    let warnings = [];
    let status = 'healthy';
    
    // 检查数据文件
    if (!csvStatus.exists && !indexStatus.exists) {
      healthScore -= 50;
      warnings.push('No data files found');
      status = 'unhealthy';
    } else if (!indexStatus.exists) {
      healthScore -= 20;
      warnings.push('Index file missing - performance may be affected');
    }
    
    // 检查内存使用
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (memUsagePercent > 80) {
      healthScore -= 15;
      warnings.push(`High memory usage: ${memUsagePercent.toFixed(1)}%`);
      if (status === 'healthy') status = 'warning';
    }
    
    // 响应时间检查
    const responseTime = Date.now() - startTime;
    if (responseTime > 1000) {
      healthScore -= 10;
      warnings.push(`Slow response time: ${responseTime}ms`);
      if (status === 'healthy') status = 'warning';
    }
    
    const healthData = {
      status: status,
      health_score: Math.max(0, healthScore),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)} minutes ${Math.floor(uptime % 60)} seconds`,
      uptime_seconds: Math.round(uptime),
      
      system: {
        platform: 'vercel',
        node_version: process.version,
        architecture: process.arch,
        memory: {
          used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          usage_percent: `${memUsagePercent.toFixed(1)}%`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        }
      },
      
      database: {
        csv_file: csvStatus,
        index_file: indexStatus,
        primary_source: indexStatus.exists ? 'index' : (csvStatus.exists ? 'csv' : 'none')
      },
      
      endpoints: {
        info: {
          url: '/',
          description: 'API information and usage guide'
        },
        health: {
          url: '/api/health',
          description: 'Service health check (current endpoint)'
        },
        lookup: {
          url: '/api/lookup',
          description: 'Single IP geolocation query'
        },
        batch: {
          url: '/api/batch',
          description: 'Batch IP geolocation query'
        }
      },
      
      performance: {
        response_time_ms: responseTime,
        status: responseTime < 100 ? 'excellent' : 
               responseTime < 500 ? 'good' : 
               responseTime < 1000 ? 'fair' : 'slow'
      },
      
      warnings: warnings,
      
      diagnostics: {
        working_directory: process.cwd(),
        data_directory_exists: fs.existsSync(path.join(process.cwd(), 'data')),
        files_in_data_dir: (() => {
          try {
            const dataDir = path.join(process.cwd(), 'data');
            return fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
          } catch (error) {
            return [`Error: ${error.message}`];
          }
        })()
      }
    };
    
    // 根据健康状态设置HTTP状态码
    const httpStatus = status === 'healthy' ? 200 : 
                      status === 'warning' ? 200 : 503;
    
    // 🎯 关键修改：使用格式化JSON输出
    const formattedJson = JSON.stringify(healthData, null, 2);
    res.status(httpStatus).end(formattedJson);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    const errorResponse = {
      status: 'error',
      health_score: 0,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime
    };
    
    // 🎯 关键修改：错误响应也使用格式化JSON
    const formattedJson = JSON.stringify(errorResponse, null, 2);
    res.status(500).end(formattedJson);
  }
});
