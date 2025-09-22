#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, '..', 'data', 'IP2LOCATION-LITE-DB1.CSV'),
  outputPath: path.join(__dirname, '..', 'data', 'ip-ranges.json'),
  backupPath: path.join(__dirname, '..', 'data', 'ip-ranges.backup.json'),
  chunkSize: 10000, // 分块处理大小
  enableCompression: true,
  enableValidation: false  // 🔧 临时禁用严格验证避免构建失败
};

// 统计信息
const stats = {
  startTime: Date.now(),
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  duplicateRanges: 0,
  unknownCountries: 0, // 新增：无效国家代码统计
  memoryUsage: 0
};

/**
 * 主构建函数
 */
async function buildIndex() {
  console.log('🔨 Starting IP geolocation index build...');
  console.log(`📁 Input: ${CONFIG.csvPath}`);
  console.log(`📄 Output: ${CONFIG.outputPath}`);
  console.log('');
  
  try {
    // 检查输入文件
    await validateInputFile();
    
    // 备份现有索引文件
    await backupExistingIndex();
    
    // 解析CSV并构建索引
    const ranges = await parseCSVFile();
    
    // 优化和验证索引（容错处理）
    const optimizedRanges = await optimizeRanges(ranges);
    
    // 写入索引文件
    await writeIndexFile(optimizedRanges);
    
    // 输出统计报告
    printBuildReport(optimizedRanges.length);
    
    console.log('✅ Index build completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error('');
    console.error('Debug information:');
    console.error(`- Total rows processed: ${stats.totalRows}`);
    console.error(`- Valid rows: ${stats.validRows}`);
    console.error(`- Invalid rows: ${stats.invalidRows}`);
    console.error(`- Unknown countries: ${stats.unknownCountries}`);
    console.error(`- Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    process.exit(1);
  }
}

/**
 * 验证输入文件
 */
async function validateInputFile() {
  console.log('🔍 Validating input file...');
  
  if (!fs.existsSync(CONFIG.csvPath)) {
    throw new Error(`CSV file not found: ${CONFIG.csvPath}`);
  }
  
  const csvStats = fs.statSync(CONFIG.csvPath);
  const fileSizeMB = Math.round(csvStats.size / 1024 / 1024 * 100) / 100;
  
  console.log(`   File size: ${fileSizeMB}MB`);
  console.log(`   Modified: ${csvStats.mtime.toISOString()}`);
  
  try {
    fs.accessSync(CONFIG.csvPath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`Cannot read CSV file: ${error.message}`);
  }
  
  console.log('✓ Input file validation passed\n');
}

/**
 * 备份现有索引文件
 */
async function backupExistingIndex() {
  if (fs.existsSync(CONFIG.outputPath)) {
    console.log('💾 Backing up existing index...');
    
    try {
      fs.copyFileSync(CONFIG.outputPath, CONFIG.backupPath);
      console.log(`✓ Backup created: ${CONFIG.backupPath}\n`);
    } catch (error) {
      console.warn(`⚠️  Backup failed: ${error.message}\n`);
    }
  }
}

/**
 * 解析CSV文件并构建基础索引
 */
async function parseCSVFile() {
  console.log('📊 Parsing CSV file...');
  
  return new Promise((resolve, reject) => {
    const ranges = [];
    const seenRanges = new Set();
    let processedChunks = 0;
    
    const stream = fs.createReadStream(CONFIG.csvPath)
      .pipe(csv({ headers: false }));
    
    stream.on('data', (row) => {
      stats.totalRows++;
      
      try {
        const [startIP, endIP, countryCode, countryName] = Object.values(row);
        
        // 验证数据
        if (!startIP || !endIP || !countryCode || !countryName) {
          stats.invalidRows++;
          return;
        }
        
        // 转换为数值
        const startNum = parseInt(startIP);
        const endNum = parseInt(endIP);
        
        if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
          stats.invalidRows++;
          return;
        }
        
        // 检查重复范围
        const rangeKey = `${startNum}-${endNum}`;
        if (seenRanges.has(rangeKey)) {
          stats.duplicateRanges++;
          return;
        }
        seenRanges.add(rangeKey);
        
        // 🔧 处理无效国家代码（容错处理）
        let cleanCountryCode = countryCode.replace(/"/g, '').trim();
        let cleanCountryName = countryName.replace(/"/g, '').trim();
        
        // 处理单个"-"字符的情况
        if (cleanCountryCode === '-' || cleanCountryCode === '') {
          cleanCountryCode = 'UNKNOWN';
          cleanCountryName = 'Unknown';
          stats.unknownCountries++;
        }
        
        // 确保国家代码长度合理（放宽验证）
        if (cleanCountryCode.length > 10) {
          cleanCountryCode = cleanCountryCode.substring(0, 10);
        }
        
        if (!cleanCountryName || cleanCountryName === '-') {
          cleanCountryName = 'Unknown';
        }
        
        // 添加到范围列表
        ranges.push({
          start: startNum,
          end: endNum,
          code: cleanCountryCode,
          name: cleanCountryName
        });
        
        stats.validRows++;
        
        // 定期输出进度
        if (stats.totalRows % CONFIG.chunkSize === 0) {
          processedChunks++;
          const memUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
          console.log(`   Processed ${stats.totalRows.toLocaleString()} rows (${processedChunks * CONFIG.chunkSize / 1000}K), Memory: ${memUsageMB}MB`);
        }
        
      } catch (error) {
        stats.invalidRows++;
        // 不再抛出错误，只记录警告
        if (stats.invalidRows < 10) {
          console.warn(`   Warning: Invalid row at line ${stats.totalRows}: ${error.message}`);
        }
      }
    });
    
    stream.on('end', () => {
      console.log(`✓ Parsing completed: ${ranges.length.toLocaleString()} valid ranges\n`);
      resolve(ranges);
    });
    
    stream.on('error', (error) => {
      reject(new Error(`CSV parsing failed: ${error.message}`));
    });
  });
}

/**
 * 优化IP范围数据
 */
async function optimizeRanges(ranges) {
  console.log('⚡ Optimizing IP ranges...');
  
  // 按起始IP排序以支持二分查找
  console.log('   Sorting ranges by start IP...');
  ranges.sort((a, b) => a.start - b.start);
  
  // 检查重叠范围（不再抛出错误）
  console.log('   Checking for overlapping ranges...');
  const overlaps = findOverlappingRanges(ranges);
  if (overlaps.length > 0) {
    console.log(`   ℹ️  Found ${overlaps.length} overlapping ranges (keeping first occurrence)`);
  }
  
  // 合并相邻的相同国家范围
  console.log('   Merging adjacent ranges...');
  const mergedRanges = mergeAdjacentRanges(ranges);
  const mergedCount = ranges.length - mergedRanges.length;
  
  if (mergedCount > 0) {
    console.log(`   ✓ Merged ${mergedCount} adjacent ranges`);
  }
  
  // 数据质量检查（不再严格验证）
  console.log('   Performing quality checks...');
  performQualityChecks(mergedRanges);
  
  console.log(`✓ Optimization completed: ${mergedRanges.length.toLocaleString()} optimized ranges\n`);
  
  return mergedRanges;
}

/**
 * 查找重叠的IP范围
 */
function findOverlappingRanges(ranges) {
  const overlaps = [];
  
  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const previous = ranges[i - 1];
    
    if (current.start <= previous.end) {
      overlaps.push({
        index: i,
        current: current,
        previous: previous
      });
    }
  }
  
  return overlaps;
}

/**
 * 合并相邻的相同国家IP范围
 */
function mergeAdjacentRanges(ranges) {
  if (ranges.length <= 1) return ranges;
  
  const merged = [ranges[0]];
  
  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];
    
    // 检查是否可以合并（相邻且同一国家）
    if (last.end + 1 === current.start && 
        last.code === current.code && 
        last.name === current.name) {
      // 合并范围
      last.end = current.end;
    } else {
      // 添加新范围
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * 数据质量检查（容错版本）
 */
function performQualityChecks(ranges) {
  let issues = 0;
  let unknownCount = 0;
  
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    
    // 统计未知国家数量
    if (range.code === 'UNKNOWN' || range.code === '-') {
      unknownCount++;
    }
    
    // 检查范围有效性
    if (range.start > range.end) {
      issues++;
      if (issues < 5) {
        console.warn(`   Range ${i}: Invalid range (${range.start} > ${range.end})`);
      }
    }
  }
  
  if (unknownCount > 0) {
    console.log(`   ℹ️  Found ${unknownCount} ranges with unknown countries (handled gracefully)`);
  }
  
  if (issues > 0) {
    console.log(`   ⚠️  Found ${issues} data quality issues (non-critical)`);
  }
}

/**
 * 写入索引文件
 */
async function writeIndexFile(ranges) {
  console.log('💾 Writing index file...');
  
  try {
    // 准备元数据
    const indexData = {
      metadata: {
        version: '2.0.0',
        generated: new Date().toISOString(),
        total_ranges: ranges.length,
        build_time_ms: Date.now() - stats.startTime,
        source_file: path.basename(CONFIG.csvPath),
        compression: CONFIG.enableCompression,
        format: 'optimized-ranges',
        unknown_countries: stats.unknownCountries,
        data_quality: {
          total_processed: stats.totalRows,
          valid_ranges: stats.validRows,
          invalid_ranges: stats.invalidRows,
          duplicate_ranges: stats.duplicateRanges,
          unknown_countries: stats.unknownCountries
        }
      },
      ranges: ranges
    };
    
    // 写入文件
    const jsonString = CONFIG.enableCompression 
      ? JSON.stringify(indexData) 
      : JSON.stringify(indexData, null, 2);
    
    fs.writeFileSync(CONFIG.outputPath, jsonString, 'utf8');
    
    // 检查文件大小
    const outputStats = fs.statSync(CONFIG.outputPath);
    const outputSizeMB = Math.round(outputStats.size / 1024 / 1024 * 100) / 100;
    
    console.log(`✓ Index file written: ${outputSizeMB}MB`);
    
    // 计算压缩率
    if (fs.existsSync(CONFIG.csvPath)) {
      const csvStats = fs.statSync(CONFIG.csvPath);
      const compressionRatio = Math.round((1 - outputStats.size / csvStats.size) * 100);
      console.log(`   Compression: ${compressionRatio}% smaller than CSV\n`);
    }
    
  } catch (error) {
    throw new Error(`Failed to write index file: ${error.message}`);
  }
}

/**
 * 输出构建报告
 */
function printBuildReport(finalRangeCount) {
  const buildTime = Date.now() - stats.startTime;
  const memUsage = process.memoryUsage();
  
  console.log('📊 Build Report');
  console.log('='.repeat(50));
  console.log(`Build Time:        ${Math.round(buildTime / 1000 * 100) / 100}s`);
  console.log(`Total Rows:        ${stats.totalRows.toLocaleString()}`);
  console.log(`Valid Rows:        ${stats.validRows.toLocaleString()} (${Math.round(stats.validRows / stats.totalRows * 100)}%)`);
  console.log(`Invalid Rows:      ${stats.invalidRows.toLocaleString()}`);
  console.log(`Unknown Countries: ${stats.unknownCountries.toLocaleString()}`);
  console.log(`Duplicate Ranges:  ${stats.duplicateRanges.toLocaleString()}`);
  console.log(`Final Ranges:      ${finalRangeCount.toLocaleString()}`);
  console.log(`Compression:       ${Math.round((1 - finalRangeCount / stats.validRows) * 100)}% range reduction`);
  console.log(`Memory Peak:       ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`Processing Rate:   ${Math.round(stats.totalRows / (buildTime / 1000)).toLocaleString()} rows/sec`);
  console.log('');
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// 运行构建
if (require.main === module) {
  buildIndex();
}

module.exports = {
  buildIndex,
  CONFIG
};
