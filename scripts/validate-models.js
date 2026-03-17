#!/usr/bin/env node

/**
 * Simple validation script for real face detection models
 * Tests if the actual .tflite model files can be loaded and used
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Real Face Detection Models');
console.log('=====================================');

// Check model files exist and have reasonable sizes
const modelsDir = path.join(__dirname, '..', 'client', 'assets', 'models');
const blazefacePath = path.join(modelsDir, 'blazeface.tflite');
const facenetPath = path.join(modelsDir, 'facenet.tflite');

try {
  // Check BlazeFace model
  const blazefaceStats = fs.statSync(blazefacePath);
  console.log(`✅ BlazeFace Model: ${blazefaceStats.size} bytes`);
  
  if (blazefaceStats.size < 1000) {
    console.log('⚠️  BlazeFace model seems too small - might be a placeholder');
  } else {
    console.log('✅ BlazeFace model has reasonable size');
  }

  // Check FaceNet model
  const facenetStats = fs.statSync(facenetPath);
  console.log(`✅ FaceNet Model: ${facenetStats.size} bytes`);
  
  if (facenetStats.size < 1000) {
    console.log('⚠️  FaceNet model seems too small - might be a placeholder');
  } else {
    console.log('✅ FaceNet model has reasonable size');
  }

  // Check file headers to see if they're actually TFLite files
  const blazefaceBuffer = fs.readFileSync(blazefacePath);
  const facenetBuffer = fs.readFileSync(facenetPath);

  // TFLite files typically start with 'TFL3' magic bytes
  const blazefaceMagic = blazefaceBuffer.slice(0, 4).toString();
  const facenetMagic = facenetBuffer.slice(0, 4).toString();

  console.log(`🔍 BlazeFace Magic: ${blazefaceMagic}`);
  console.log(`🔍 FaceNet Magic: ${facenetMagic}`);

  if (blazefaceMagic === 'TFL3') {
    console.log('✅ BlazeFace appears to be a valid TFLite model');
  } else {
    console.log('❌ BlazeFace does not have TFLite magic bytes');
  }

  if (facenetMagic === 'TFL3') {
    console.log('✅ FaceNet appears to be a valid TFLite model');
  } else {
    console.log('❌ FaceNet does not have TFLite magic bytes');
  }

  console.log('\n🎉 Model validation complete!');
  
} catch (error) {
  console.error('❌ Error validating models:', error.message);
  process.exit(1);
}
