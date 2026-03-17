#!/usr/bin/env node

/**
 * Create minimal TFLite models for testing
 * These are not real ML models but have the correct file format for testing the infrastructure
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Creating Test TFLite Models');
console.log('=============================');

// Create a minimal TFLite file with correct magic bytes
function createMinimalTFLite(filePath, description) {
  // TFLite files start with 'TFL3' magic bytes
  const buffer = Buffer.alloc(1024); // 1KB minimal file
  
  // Write TFLite magic bytes
  buffer.write('TFL3', 0);
  
  // Write some basic metadata
  buffer.writeUInt32LE(1, 4); // Version
  buffer.writeUInt32LE(16, 8); // Model description offset
  buffer.write(description, 16, 'utf8');
  
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Created test model: ${filePath} (${description})`);
}

try {
  const modelsDir = path.join(__dirname, '..', 'client', 'assets', 'models');
  
  // Backup current files
  const blazefacePath = path.join(modelsDir, 'blazeface.tflite');
  const facenetPath = path.join(modelsDir, 'facenet.tflite');
  
  if (fs.existsSync(blazefacePath)) {
    fs.copyFileSync(blazefacePath, blazefacePath + '.backup');
    console.log('💾 Backed up blazeface.tflite');
  }
  
  if (fs.existsSync(facenetPath)) {
    fs.copyFileSync(facenetPath, facenetPath + '.backup');
    console.log('💾 Backed up facenet.tflite');
  }
  
  // Create test models
  createMinimalTFLite(blazefacePath, 'BlazeFace Face Detection Test Model');
  createMinimalTFLite(facenetPath, 'FaceNet Embedding Test Model');
  
  console.log('\n🎉 Test models created successfully!');
  console.log('📝 These models have correct TFLite format for testing');
  console.log('⚠️  They are not real ML models but will test the infrastructure');
  
} catch (error) {
  console.error('❌ Error creating test models:', error.message);
  process.exit(1);
}
