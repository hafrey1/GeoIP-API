const express = require('express');
const { lookupIP, lookupIPs } = require('../database');
const { validateIP, sanitizeIPs } = require('../utils/ipUtils');

const router = express.Router();

// 单个IP查询
router.get('/lookup', async (req, res) => {
  const { ip } = req.query;

  if (!ip) {
    return res.status(400).json({
      success: false,
      error: 'Missing IP parameter',
      example: '/api/lookup?ip=8.8.8.8'
    });
  }

  if (!validateIP(ip)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IP address format',
      provided: ip
    });
  }

  try {
    const result = await lookupIP(ip);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Database lookup failed'
    });
  }
});

// 批量IP查询
router.post('/batch', async (req, res) => {
  const { ips } = req.body;

  if (!ips || !Array.isArray(ips)) {
    return res.status(400).json({
      success: false,
      error: 'Request body must contain an "ips" array',
      example: { ips: ['8.8.8.8', '1.1.1.1'] }
    });
  }

  if (ips.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'IPs array cannot be empty'
    });
  }

  if (ips.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 100 IPs per request',
      provided: ips.length
    });
  }

  // 验证和清理IP地址
  const sanitized = sanitizeIPs(ips);
  
  if (sanitized.invalid.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IP addresses found',
      invalid_ips: sanitized.invalid
    });
  }

  try {
    const results = await lookupIPs(sanitized.valid);
    res.json({
      success: true,
      count: sanitized.valid.length,
      data: results
    });
  } catch (error) {
    console.error('Batch lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch lookup failed'
    });
  }
});

module.exports = router;
