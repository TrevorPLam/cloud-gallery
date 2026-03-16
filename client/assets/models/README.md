# Face Recognition Models

This directory contains TensorFlow Lite models for on-device face detection and recognition.

## Models Required

### BlazeFace Face Detection Model
- **File**: `blazeface.tflite`
- **Purpose**: Real-time face detection with bounding boxes and landmarks
- **Input**: 128x128 RGB image
- **Output**: Face bounding boxes, confidence scores, and 6 facial landmarks
- **Source**: [MediaPipe BlazeFace](https://github.com/google/mediapipe/tree/master/mediapipe/models/face_detection_front.tflite)

### FaceNet Embedding Model
- **File**: `facenet.tflite`
- **Purpose**: Generate 128-dimensional face embeddings for recognition
- **Input**: 160x160 RGB face image (aligned)
- **Output**: 128-dimensional embedding vector
- **Source**: Research FaceNet models (ensure proper licensing)

## Model Integration

The models are automatically loaded and managed by the ML services:

1. **Face Detection Service** (`client/lib/ml/face-detection.ts`)
   - Loads BlazeFace model
   - Performs real-time face detection
   - Outputs bounding boxes and landmarks

2. **Face Embedding Service** (`client/lib/ml/face-embeddings.ts`)
   - Loads FaceNet model
   - Generates face embeddings from detected faces
   - Applies alignment and normalization

3. **Face Clustering Service** (`client/lib/ml/face-clustering.ts`)
   - Uses embeddings for person clustering
   - Implements DBSCAN algorithm
   - Manages person identity and metadata

## Model Files

To complete the implementation:

1. Download the official BlazeFace model from MediaPipe
2. Obtain a FaceNet model with proper licensing
3. Place the `.tflite` files in this directory
4. Update the model paths in the service files if needed

## Performance Considerations

- Models are automatically optimized for device capabilities
- GPU acceleration is used when available (CoreML on iOS, Android GPU)
- Memory management prevents model overload
- Background loading prevents UI blocking

## Privacy and Compliance

- All processing happens on-device (zero-knowledge architecture)
- No biometric data is sent to servers
- Models are stored locally and encrypted when possible
- GDPR compliance requires explicit user consent

## Testing

Placeholder models can be used for testing the UI and logic:
- Mock model outputs can simulate real inference
- Test data can validate clustering algorithms
- Performance can be benchmarked without real models
