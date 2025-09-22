/**
 * IPv4地址格式验证
 * 支持标准IPv4格式：0.0.0.0 - 255.255.255.255
 * @param {string} ip - 待验证的IP地址字符串
 * @returns {boolean} - 验证结果
 */
function validateIP(ip) {
  if (typeof ip !== 'string') {
    return false;
  }
  
  // IPv4正则表达式
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  // 额外验证：确保不是保留地址
  const octets = ip.split('.').map(Number);
  
  // 排除 0.0.0.0
  if (octets.every(octet => octet === 0)) {
    return false;
  }
  
  // 排除 255.255.255.255
  if (octets.every(octet => octet === 255)) {
    return false;
  }
  
  return true;
}

/**
 * 域名格式验证
 * 支持标准域名格式，包括国际化域名
 * @param {string} domain - 待验证的域名字符串
 * @returns {boolean} - 验证结果
 */
function validateDomain(domain) {
  if (typeof domain !== 'string' || domain.length === 0) {
    return false;
  }
  
  // 基本长度检查
  if (domain.length > 253) {
    return false;
  }
  
  // 域名正则表达式 - 支持国际化域名和常见TLD
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  
  // 先检查基本格式
  if (!domainRegex.test(domain)) {
    return false;
  }
  
  // 检查是否包含有效的TLD
  const parts = domain.split('.');
  if (parts.length < 2) {
    return false;
  }
  
  // 最后一部分应该是有效的TLD
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) {
    return false;
  }
  
  // 排除以点开头或结尾的域名
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }
  
  // 排除连续的点
  if (domain.includes('..')) {
    return false;
  }
  
  return true;
}

/**
 * 判断输入是IP还是域名
 * @param {string} input - 输入字符串
 * @returns {Object} - {type: 'ip'|'domain'|'unknown', value: string}
 */
function identifyInput(input) {
  if (typeof input !== 'string') {
    return { type: 'unknown', value: input };
  }
  
  const trimmedInput = input.trim();
  
  if (validateIP(trimmedInput)) {
    return { type: 'ip', value: trimmedInput };
  }
  
  if (validateDomain(trimmedInput)) {
    return { type: 'domain', value: trimmedInput };
  }
  
  return { type: 'unknown', value: trimmedInput };
}

/**
 * DNS解析域名为IP地址
 * @param {string} domain - 域名
 * @returns {Promise<string>} - 解析后的IP地址
 */
async function resolveDomainToIP(domain) {
  const dns = require('dns').promises;
  
  try {
    // 解析A记录获取IPv4地址
    const addresses = await dns.resolve4(domain);
    
    if (addresses && addresses.length > 0) {
      // 返回第一个有效的IPv4地址
      return addresses[0];
    }
    
    throw new Error('No IPv4 address found');
  } catch (error) {
    // 如果dns模块不可用，尝试使用fetch方法
    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
      const data = await response.json();
      
      if (data.Answer && data.Answer.length > 0) {
        // 寻找A记录
        const aRecord = data.Answer.find(record => record.type === 1);
        if (aRecord && aRecord.data) {
          return aRecord.data;
        }
      }
      
      throw new Error('No A record found via DNS over HTTPS');
    } catch (fetchError) {
      throw new Error(`DNS resolution failed: ${error.message} | Fallback failed: ${fetchError.message}`);
    }
  }
}

/**
 * 批量域名/IP地址验证和分类
 * @param {Array<string>} inputs - 输入数组（IP地址或域名）
 * @returns {Object} - 包含分类结果的对象
 */
function validateInputs(inputs) {
  const results = {
    ips: [],
    domains: [],
    invalid: [],
    duplicates: [],
    stats: {
      total: inputs.length,
      ipCount: 0,
      domainCount: 0,
      invalidCount: 0,
      duplicateCount: 0
    }
  };
  
  const seen = new Set();
  
  inputs.forEach((input, index) => {
    const normalizedInput = typeof input === 'string' ? input.trim() : input;
    
    // 检查重复
    if (seen.has(normalizedInput)) {
      results.duplicates.push({ input: normalizedInput, index });
      results.stats.duplicateCount++;
      return;
    }
    seen.add(normalizedInput);
    
    // 识别输入类型
    const identified = identifyInput(normalizedInput);
    
    switch (identified.type) {
      case 'ip':
        results.ips.push(identified.value);
        results.stats.ipCount++;
        break;
      case 'domain':
        results.domains.push(identified.value);
        results.stats.domainCount++;
        break;
      default:
        results.invalid.push({ 
          input: normalizedInput, 
          index, 
          reason: 'Invalid IP address or domain name format' 
        });
        results.stats.invalidCount++;
        break;
    }
  });
  
  return results;
}

/**
 * 批量IP地址验证（保持向后兼容）
 * @param {Array<string>} ips - IP地址数组
 * @returns {Object} - 包含有效和无效IP的分类结果
 */
function validateIPs(ips) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: [],
    stats: {
      total: ips.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0
    }
  };
  
  const seen = new Set();
  
  ips.forEach((ip, index) => {
    // 检查重复
    if (seen.has(ip)) {
      results.duplicates.push({ ip, index });
      results.stats.duplicateCount++;
      return;
    }
    seen.add(ip);
    
    // 验证格式
    if (validateIP(ip)) {
      results.valid.push(ip);
      results.stats.validCount++;
    } else {
      results.invalid.push({ ip, index, reason: 'Invalid IPv4 format' });
      results.stats.invalidCount++;
    }
  });
  
  return results;
}

/**
 * IP地址转换为32位整数
 * @param {string} ip - IPv4地址字符串
 * @returns {number} - 32位无符号整数
 */
function ipToNumber(ip) {
  const octets = ip.split('.').map(Number);
  return (octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0;
}

/**
 * 32位整数转换为IP地址
 * @param {number} num - 32位无符号整数
 * @returns {string} - IPv4地址字符串
 */
function numberToIP(num) {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * 检查IP是否在指定范围内
 * @param {string} ip - 待检查的IP地址
 * @param {string} startIP - 起始IP地址
 * @param {string} endIP - 结束IP地址
 * @returns {boolean} - 是否在范围内
 */
function isIPInRange(ip, startIP, endIP) {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(startIP);
  const endNum = ipToNumber(endIP);
  
  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * 将数组分割成指定大小的块
 * @param {Array} array - 原数组
 * @param {number} chunkSize - 块大小
 * @returns {Array<Array>} - 分割后的数组块
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  
  return chunks;
}

/**
 * 生成随机IP地址（用于测试）
 * @param {number} count - 生成数量
 * @param {boolean} includePrivate - 是否包含私有IP
 * @returns {Array<string>} - 随机IP地址数组
 */
function generateRandomIPs(count = 1, includePrivate = false) {
  const ips = [];
  
  for (let i = 0; i < count; i++) {
    let ip;
    
    do {
      const octets = [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
      ];
      
      ip = octets.join('.');
      
      // 如果不包含私有IP，则排除私有地址范围
      if (!includePrivate && isPrivateIP(ip)) {
        continue;
      }
      
      break;
    } while (true);
    
    ips.push(ip);
  }
  
  return ips;
}

/**
 * 检查是否为私有IP地址
 * @param {string} ip - IP地址
 * @returns {boolean} - 是否为私有IP
 */
function isPrivateIP(ip) {
  const ipNum = ipToNumber(ip);
  
  // 10.0.0.0/8
  if (ipNum >= ipToNumber('10.0.0.0') && ipNum <= ipToNumber('10.255.255.255')) {
    return true;
  }
  
  // 172.16.0.0/12
  if (ipNum >= ipToNumber('172.16.0.0') && ipNum <= ipToNumber('172.31.255.255')) {
    return true;
  }
  
  // 192.168.0.0/16
  if (ipNum >= ipToNumber('192.168.0.0') && ipNum <= ipToNumber('192.168.255.255')) {
    return true;
  }
  
  // 127.0.0.0/8 (localhost)
  if (ipNum >= ipToNumber('127.0.0.0') && ipNum <= ipToNumber('127.255.255.255')) {
    return true;
  }
  
  return false;
}

// 导出所有函数
module.exports = {
  validateIP,
  validateDomain,
  identifyInput,
  resolveDomainToIP,
  validateInputs,
  validateIPs,
  ipToNumber,
  numberToIP,
  isIPInRange,
  chunkArray,
  generateRandomIPs,
  isPrivateIP
};
