// AI-META-BEGIN
// AI-META: ML/AI photo analysis service with object detection, OCR, and perceptual hashing
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by photo upload flow and ML analysis screens
// DEPENDENCIES: react-native-fast-tflite, react-native-mlkit-ocr, react-native
// DANGER: Model loading and tensor operations require proper memory management
// CHANGE-SAFETY: Add new ML capabilities by extending the MLAnalysisResult interface
// TESTS: client/lib/ml/photo-analyzer.test.ts
// AI-META-END

import { Platform, InteractionManager } from "react-native";
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import RNMlkitOcr from "react-native-mlkit-ocr";
import { getPerceptualHasher, generateCompositeHash } from "../photo/perceptual-hash";
import { FaceDetectionService } from "./face-detection";
import { preprocessImageForModel } from "./image-preprocessing";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface TextRecognitionResult {
  text: string;
  blocks?: {
    text: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
}

export interface MLAnalysisResult {
  // Object detection results
  objects?: DetectedObject[];

  // Face detection results
  faces?: FaceDetectionResult[];

  // OCR text extraction results
  ocrText?: string;
  ocrLanguage?: string;

  // Perceptual hash for duplicate detection
  perceptualHash?: string;

  // Processing metadata
  processingTime: number;
  mlVersion: string;
  timestamp: Date;
}

export interface FaceDetectionResult {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks?: Array<{
    x: number;
    y: number;
    type: string;
  }>;
  embedding?: Float32Array; // 128-dimensional face embedding
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ModelConfig {
  name: string;
  inputSize: number;
  outputLabels: string[];
  threshold: number;
}

// ─────────────────────────────────────────────────────────
// MODEL CONFIGURATIONS
// ─────────────────────────────────────────────────────────

const OBJECT_DETECTION_CONFIG: ModelConfig = {
  name: "mobilenet_v3",
  inputSize: 192,
  outputLabels: [], // Will be loaded from model metadata
  threshold: 0.7,
};

const ML_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────
// PHOTO ANALYZER CLASS
// ─────────────────────────────────────────────────────────

export class PhotoAnalyzer {
  private objectDetectionModel: TensorflowModel | null = null;
  private faceDetectionService: FaceDetectionService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.faceDetectionService = new FaceDetectionService();
    this.initializeModels();
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  /**
   * Initialize ML models asynchronously
   * Uses factory pattern for platform-specific model loading
   */
  private async initializeModels(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeModelsInternal();
    return this.initializationPromise;
  }

  private async _initializeModelsInternal(): Promise<void> {
    try {
      await this.loadObjectDetectionModel();
      this.isInitialized = true;
      console.log("PhotoAnalyzer: ML models initialized successfully");
    } catch (error) {
      console.error(
        "PhotoAnalyzer: Object detection model unavailable, continuing without it:",
        error,
      );
      this.objectDetectionModel = null;
      this.isInitialized = true;
    }
  }

  /**
   * Load object detection model when available (e.g. from app assets).
   * Optional: OCR and perceptual hash work without it.
   */
  private async loadObjectDetectionModel(): Promise<void> {
    try {
      const modelPath = this.getModelPath("mobilenet_v3");
      this.objectDetectionModel = await loadTensorflowModel(modelPath);
      if (!this.objectDetectionModel) throw new Error("Failed to load model");
      console.log("PhotoAnalyzer: Object detection model loaded");
    } catch (error) {
      throw error;
    }
  }

  /**
   * Factory method for getting model path based on platform
   */
  private getModelPath(modelName: string): any {
    // For development, use placeholder - in production, actual model files
    // would be bundled with the app
    if (__DEV__) {
      return { url: `assets/models/${modelName}.tflite` };
    }

    // Production model loading - use require format for react-native-fast-tflite
    try {
      return require(`assets/models/${modelName}.tflite`);
    } catch (error) {
      // Fallback to URL format
      return { url: `assets/models/${modelName}.tflite` };
    }
  }

  // ─── PUBLIC ANALYSIS METHODS ───────────────────────────────

  /**
   * Perform complete ML analysis on a photo
   * Runs in background to avoid UI blocking
   */
  public async analyzePhoto(imageUri: string): Promise<MLAnalysisResult> {
    const startTime = Date.now();

    // Run in background to avoid blocking UI thread
    const result = await new Promise<MLAnalysisResult>((resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await this.initializeModels();

          const analysisResult: MLAnalysisResult = {
            processingTime: 0,
            mlVersion: ML_VERSION,
            timestamp: new Date(),
          };

          // Perform object detection
          if (this.objectDetectionModel) {
            const objects = await this.detectObjects(imageUri);
            analysisResult.objects = objects;
          }

          // Perform face detection and generate embeddings
          try {
            const faces = await this.detectFacesWithEmbeddings(imageUri);
            if (faces.length > 0) {
              analysisResult.faces = faces;
            }
          } catch (error) {
            console.warn("PhotoAnalyzer: Face detection failed, continuing without it:", error);
          }

          // Perform OCR text extraction
          const ocrResult = await this.extractText(imageUri);
          if (ocrResult.text) {
            analysisResult.ocrText = ocrResult.text;
            analysisResult.ocrLanguage = this.detectLanguage(ocrResult.text);
          }

          // Generate perceptual hash
          const hash = await this.generatePerceptualHash(imageUri);
          analysisResult.perceptualHash = hash;

          analysisResult.processingTime = Date.now() - startTime;

          resolve(analysisResult);
        } catch (error) {
          reject(error);
        }
      });
    });

    return result;
  }

  /**
   * Detect faces and generate embeddings using FaceDetectionService
   */
  private async detectFacesWithEmbeddings(imageUri: string): Promise<FaceDetectionResult[]> {
    try {
      // Load image data from URI
      const imageData = await this.loadImageDataFromUri(imageUri);
      
      // Detect faces using BlazeFace
      const faceDetections = await this.faceDetectionService.detectFaces(
        imageData.data,
        imageData.width,
        imageData.height
      );

      if (faceDetections.length === 0) {
        return [];
      }

      console.log(`PhotoAnalyzer: Detected ${faceDetections.length} faces, generating embeddings`);

      // Extract face regions for embedding generation
      const faceImages = faceDetections.map(detection => {
        const faceImageData = this.extractFaceRegion(
          imageData.data,
          imageData.width,
          imageData.height,
          detection.boundingBox
        );
        
        return {
          imageData: faceImageData,
          width: Math.round(detection.boundingBox.width * imageData.width),
          height: Math.round(detection.boundingBox.height * imageData.height)
        };
      });

      // Generate embeddings using FaceNet
      const embeddings = await this.faceDetectionService.generateFaceEmbeddings(faceImages);

      // Combine face detections with embeddings
      const faceResults: FaceDetectionResult[] = faceDetections.map((detection, index) => ({
        boundingBox: detection.boundingBox,
        confidence: detection.confidence,
        landmarks: detection.landmarks.map(landmark => ({
          x: landmark.x,
          y: landmark.y,
          type: landmark.type
        })),
        embedding: embeddings[index]
      }));

      console.log(`PhotoAnalyzer: Successfully processed ${faceResults.length} faces with embeddings`);
      return faceResults;

    } catch (error) {
      console.error("PhotoAnalyzer: Face detection with embeddings failed:", error);
      throw error;
    }
  }

  /**
   * Load image data from URI for processing
   */
  private async loadImageDataFromUri(imageUri: string): Promise<{
    data: Uint8Array;
    width: number;
    height: number;
  }> {
    // This is a placeholder implementation
    // In production, would use proper image loading library
    // For now, return dummy data to test the pipeline
    
    const width = 640;
    const height = 480;
    const data = new Uint8Array(width * height * 3);
    
    // Fill with dummy RGB data
    for (let i = 0; i < data.length; i += 3) {
      data[i] = Math.random() * 255;     // R
      data[i + 1] = Math.random() * 255; // G
      data[i + 2] = Math.random() * 255; // B
    }
    
    return { data, width, height };
  }

  /**
   * Extract face region from image data
   */
  private extractFaceRegion(
    imageData: Uint8Array,
    imageWidth: number,
    imageHeight: number,
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Uint8Array {
    // Convert normalized coordinates to pixel coordinates
    const startX = Math.floor(boundingBox.x * imageWidth);
    const startY = Math.floor(boundingBox.y * imageHeight);
    const faceWidth = Math.floor(boundingBox.width * imageWidth);
    const faceHeight = Math.floor(boundingBox.height * imageHeight);
    
    // Extract face region
    const faceData = new Uint8Array(faceWidth * faceHeight * 3);
    
    for (let y = 0; y < faceHeight; y++) {
      for (let x = 0; x < faceWidth; x++) {
        const srcX = startX + x;
        const srcY = startY + y;
        
        if (srcX >= 0 && srcX < imageWidth && srcY >= 0 && srcY < imageHeight) {
          const srcIndex = (srcY * imageWidth + srcX) * 3;
          const destIndex = (y * faceWidth + x) * 3;
          
          // Copy RGB values
          faceData[destIndex] = imageData[srcIndex] || 0;
          faceData[destIndex + 1] = imageData[srcIndex + 1] || 0;
          faceData[destIndex + 2] = imageData[srcIndex + 2] || 0;
        }
      }
    }
    
    return faceData;
  }
  private async detectObjects(imageUri: string): Promise<DetectedObject[]> {
    if (!this.objectDetectionModel) {
      throw new Error("Object detection model not loaded");
    }

    try {
      // Preprocess image to match model input requirements
      const preprocessedImage = await this.preprocessImage(
        imageUri,
        OBJECT_DETECTION_CONFIG.inputSize,
      );

      // Run inference
      const outputs = await this.objectDetectionModel.run([preprocessedImage]);

      // Post-process results
      const detections = this.postprocessObjectDetection(outputs);

      return detections;
    } catch (error) {
      console.error("PhotoAnalyzer: Object detection failed:", error);
      return [];
    }
  }

  /**
   * Extract text using ML Kit OCR (on-device, privacy-preserving).
   */
  private async extractText(imageUri: string): Promise<TextRecognitionResult> {
    try {
      const blocks = await RNMlkitOcr.detectFromUri(imageUri);
      if (!blocks || blocks.length === 0) return { text: "" };
      const text = blocks
        .map((b) => b.text)
        .filter(Boolean)
        .join("\n");
      const resultBlocks = blocks.map((block) => ({
        text: block.text,
        boundingBox: block.bounding
          ? {
              x: block.bounding.left,
              y: block.bounding.top,
              width: block.bounding.width,
              height: block.bounding.height,
            }
          : undefined,
      }));
      return { text, blocks: resultBlocks };
    } catch (error) {
      console.error("PhotoAnalyzer: OCR failed:", error);
      return { text: "" };
    }
  }

  /**
   * Generate perceptual hash for duplicate detection
   * Uses the advanced perceptual hashing service
   */
  private async generatePerceptualHash(imageUri: string): Promise<string> {
    try {
      // Use the comprehensive perceptual hashing service
      const hash = await generateCompositeHash(imageUri);
      return hash;
    } catch (error) {
      console.error("PhotoAnalyzer: Perceptual hashing failed:", error);
      return "";
    }
  }

  // ─── IMAGE PROCESSING UTILITIES ─────────────────────────────

  /**
   * Preprocess image for model input
   * Resize and normalize to match model requirements
   */
  private async preprocessImage(
    imageUri: string,
    targetSize: number,
  ): Promise<Float32Array> {
    try {
      // Use real image preprocessing with expo-image-manipulator
      const result = await preprocessImageForModel(
        imageUri,
        targetSize,
        '[-1,1]' // MobileNet normalization
      );
      
      console.log(`PhotoAnalyzer: Image preprocessed to ${result.width}x${result.height} in ${result.processingTime}ms`);
      
      return result.tensor;
    } catch (error) {
      console.error("PhotoAnalyzer: Image preprocessing failed:", error);
      throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Post-process object detection outputs
   * Convert MobileNet classification outputs to DetectedObject format
   */
  private postprocessObjectDetection(outputs: any[]): DetectedObject[] {
    try {
      if (!outputs || outputs.length === 0) {
        console.log("PhotoAnalyzer: No model outputs to post-process");
        return [];
      }

      // MobileNet typically outputs classification probabilities
      // The first output tensor contains the classification scores
      const classificationScores = outputs[0] as Float32Array;
      
      if (!classificationScores || classificationScores.length === 0) {
        console.log("PhotoAnalyzer: Empty classification scores");
        return [];
      }

      // Load ImageNet labels (simplified version - in production would load from file)
      const imagenetLabels = this.getImagenetLabels();
      
      if (classificationScores.length !== imagenetLabels.length) {
        console.warn(`PhotoAnalyzer: Label count mismatch: ${classificationScores.length} scores vs ${imagenetLabels.length} labels`);
      }

      // Convert scores to detected objects with confidence threshold
      const detectedObjects: DetectedObject[] = [];
      const confidenceThreshold = OBJECT_DETECTION_CONFIG.threshold;

      for (let i = 0; i < Math.min(classificationScores.length, imagenetLabels.length); i++) {
        const confidence = classificationScores[i];
        const label = imagenetLabels[i];

        // Apply confidence threshold and filter out background classes
        if (confidence >= confidenceThreshold && this.isValidObjectLabel(label)) {
          detectedObjects.push({
            label: this.formatLabel(label),
            confidence: confidence,
            boundingBox: {
              // For classification models, use full image as bounding box
              x: 0,
              y: 0,
              width: 1.0, // Normalized coordinates (0-1)
              height: 1.0,
            },
          });
        }
      }

      // Sort by confidence (highest first) and limit to top 10
      const sortedObjects = detectedObjects
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);

      console.log(`PhotoAnalyzer: Detected ${sortedObjects.length} objects above threshold ${confidenceThreshold}`);
      
      return sortedObjects;
    } catch (error) {
      console.error("PhotoAnalyzer: Post-processing failed:", error);
      return [];
    }
  }

  /**
   * Get ImageNet class labels
   * In production, this would load from a labels file included with the model
   */
  private getImagenetLabels(): string[] {
    // Simplified ImageNet labels for demonstration
    // In production, load from assets/models/imagenet_labels.txt
    return [
      "background", "tench", "goldfish", "great white shark", "tiger shark",
      "hammerhead", "electric ray", "stingray", "cock", "hen",
      "ostrich", "brambling", "goldfinch", "house finch", "junco",
      "indigo bunting", "robin", "bulbul", "jay", "magpie",
      "chickadee", "water ouzel", "kite", "bald eagle", "vulture",
      "great grey owl", "European fire salamander", "common newt", "eft", "spotted salamander",
      "axolotl", "bullfrog", "tree frog", "tailed frog", "loggerhead",
      "leatherback turtle", "mud turtle", "terrapin", "box turtle", "banded gecko",
      "common iguana", "American chameleon", "whiptail", "agama", "frilled lizard",
      "alligator lizard", "Gila monster", "green lizard", "African chameleon", "Komodo dragon",
      "African crocodile", "American alligator", "triceratops", "thunder snake", "ringneck snake",
      "hognose snake", "green snake", "king snake", "garter snake", "water snake",
      "vine snake", "night snake", "boa constrictor", "rock python", "Indian cobra",
      "green mamba", "sea snake", "horned viper", "diamondback", "sidewinder",
      "trilobite", "harvestman", "scorpion", "black and gold garden spider", "barn spider",
      "garden spider", "black widow", "tarantula", "wolf spider", "tick",
      "centipede", "black grouse", "ptarmigan", "ruffed grouse", "prairie chicken",
      "peacock", "quail", "partridge", "African grey", "macaw",
      "sulphur-crested cockatoo", "lorikeet", "coucal", "bee eater", "hornbill",
      "hummingbird", "jacamar", "toucan", "drake", "red-breasted merganser",
      "goose", "black swan", "tusker", "echidna", "platypus",
      "wallaby", "koala", "wombat", "jellyfish", "sea anemone",
      "brain coral", "flatworm", "nematode", "conch", "snail",
      "slug", "sea slug", "chiton", "chambered nautilus", "Dungeness crab",
      "rock crab", "fiddler crab", "king crab", "American lobster", "spiny lobster",
      "crayfish", "hermit crab", "isopod", "white stork", "black stork",
      "spoonbill", "flamingo", "little blue heron", "American egret", "heron",
      "bustard", "ruddy turnstone", "red-backed sandpiper", "redshank", "dowitcher",
      "oystercatcher", "pelican", "king penguin", "albatross", "grey whale",
      "humpback whale", "blue whale", "beluga", "narwhal", "sperm whale",
      "killer whale", "dugong", "sea lion", "Chihuahua", "Japanese spaniel",
      "Maltese dog", "Pekinese", "Shih-Tzu", "Blenheim spaniel", "papillon",
      "toy terrier", "Rhodesian ridgeback", "Afghan hound", "basset", "beagle",
      "bloodhound", "bluetick", "black-and-tan coonhound", "Walker hound", "English foxhound",
      "redbone", "borzoi", "Irish wolfhound", "Italian greyhound", "whippet",
      "Ibizan hound", "Norwegian elkhound", "otterhound", "Saluki", "Scottish deerhound",
      "Weimaraner", "Staffordshire bullterrier", "American Staffordshire terrier", "Bedlington terrier", "Border terrier",
      "Kerry blue terrier", "Irish terrier", "Norfolk terrier", "Norwich terrier", "Yorkshire terrier",
      "wire-haired fox terrier", "Lakeland terrier", "Sealyham terrier", "Airedale", "cairn",
      "Australian terrier", "Dandie Dinmont", "Boston bull", "miniature schnauzer", "giant schnauzer",
      "standard schnauzer", "Scotch terrier", "Tibetan terrier", "silky terrier", "soft-coated wheaton terrier",
      "West Highland white terrier", "Lhasa", "flat-coated retriever", "curly-coated retriever", "golden retriever",
      "Labrador retriever", "Chesapeake Bay retriever", "German short-haired pointer", "vizsla", "English setter",
      "Irish setter", "Gordon setter", "Brittany spaniel", "clumber", "English springer",
      "Welsh springer spaniel", "cocker spaniel", "Sussex spaniel", "Irish water spaniel", "kuvasz",
      "schipperke", "groenendael", "malinois", "briard", "kelpie",
      "komondor", "Old English sheepdog", "Shetland sheepdog", "collie", "Border collie",
      "Bouvier des Flandres", "Rottweiler", "German shepherd", "Doberman", "miniature pinscher",
      "Greater Swiss Mountain dog", "Bernese mountain dog", "Appenzeller", "EntleBucher", "boxer",
      "bull mastiff", "Tibetan mastiff", "French bulldog", "Great Dane", "Saint Bernard",
      "Eskimo dog", "malamute", "Siberian husky", "dalmatian", "dachshund",
      "miniature pinscher", "Pembroke", "Cardigan", "toy poodle", "miniature poodle",
      "standard poodle", "Mexican hairless", "timber wolf", "white wolf", "red wolf",
      "coyote", "dingo", "dhole", "African hunting dog", "hyena",
      "red fox", "kit fox", "Arctic fox", "grey fox", "tabby cat",
      "tiger cat", "Persian cat", "Siamese cat", "Egyptian cat", "cougar",
      "lynx", "leopard", "snow leopard", "jaguar", "lion",
      "tiger", "cheetah", "brown bear", "American black bear", "ice bear",
      "sloth bear", "mongoose", "meerkat", "tiger beetle", "ladybug",
      "ground beetle", "long-horned beetle", "leaf beetle", "dung beetle", "rhinoceros beetle",
      "weevil", "fly", "bee", "ant", "grasshopper",
      "cricket", "walking stick", "cockroach", "mantis", "cicada",
      "leafhopper", "lacewing", "dragonfly", "damselfly", "admiral",
      "ringlet", "monarch", "cabbage butterfly", "sulphur butterfly", "lycaenid",
      "harvester", "snail", "slug", "sea slug", "nudibranch",
      "banana", "hand-held computer", "computer keyboard", "desktop computer", "monitor",
      "notebook computer", "mouse", "electric fan", "electric shaver", "bicycle",
      "tricycle", "unicycle", "motor scooter", "sports car", "pickup truck",
      "fire engine", "school bus", "tractor", "lawn mower", "harvester",
      "helmet", "suitcase", "brassiere", "backpack", "wardrobe",
      "cloak", "dress", "bunting", "apron", "sari",
      "gown", "raincoat", "vest", "shirt", "sweater",
      "tunic", "tank top", "maillot", "bikini", "bath towel",
      "barbell", "trampoline", "ski", "snowboard", "sports ball",
      "kayak", "baseball bat", "skateboard", "surfboard", "tennis racket",
      "balloon", "scissors", "military uniform", "gas mask", "feather boa",
      "necktie", "bow tie", "abaya", "academic gown", "lab coat",
      "stethoscope", "academic cap", "mortarboard", "pajamas", "swimming trunks",
      "kimono", "clothing", "web", "spider web", "cobweb",
      "plate", "dish", "tableware", "coffee mug", "teapot",
      "wine bottle", "cup", "fork", "knife", "spoon",
      "bowl", "banana", "apple", "sandwich", "orange",
      "broccoli", "carrot", "hot dog", "pizza", "donut",
      "cake", "chair", "sofa", "potted plant", "bed",
      "dining table", "toilet", "tv", "laptop", "mouse",
      "remote", "keyboard", "cell phone", "microwave", "oven",
      "toaster", "sink", "refrigerator", "book", "clock",
      "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
      "backpack", "umbrella", "handbag", "tie", "suitcase",
      "frisbee", "skis", "snowboard", "sports ball", "kite",
      "baseball bat", "skateboard", "surfboard", "tennis racket", "bottle",
      "wine glass", "cup", "fork", "knife", "spoon",
      "bowl", "banana", "apple", "sandwich", "orange",
      "broccoli", "carrot", "hot dog", "pizza", "donut",
      "cake", "chair", "sofa", "potted plant", "bed",
      "dining table", "toilet", "tv", "laptop", "mouse",
      "remote", "keyboard", "cell phone", "microwave", "oven",
      "toaster", "sink", "refrigerator", "book", "clock",
      "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
    ];
  }

  /**
   * Check if a label represents a valid object (not background or irrelevant)
   */
  private isValidObjectLabel(label: string): boolean {
    const invalidLabels = [
      'background', 'web', 'spider web', 'cobweb', 'clothing', 'wardrobe',
      'suitcase', 'backpack', 'handbag', 'umbrella', 'tie'
    ];
    
    return !invalidLabels.includes(label.toLowerCase());
  }

  /**
   * Format label for better readability
   */
  private formatLabel(label: string): string {
    return label
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Compute a deterministic hash for the image (content-addressable).
   * Uses a hash of the URI so same image URI yields same hash for duplicate detection.
   * Full perceptual (dHash) would require pixel access (native module or image decoder).
   */
  private async computeDifferenceHash(imageUri: string): Promise<string> {
    const input = imageUri.trim();
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h = (h << 5) - h + c;
      h = h & 0xffffffff;
    }
    const hex = Math.abs(h).toString(16);
    return hex.padStart(16, "0").slice(0, 16);
  }

  /**
   * Detect language of OCR text
   * Simple heuristic-based language detection
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on character sets
    if (!text || text.length === 0) return "en";

    // Check for common language patterns
    if (/[\u4e00-\u9fff]/.test(text)) return "zh"; // Chinese
    if (/[\u0400-\u04ff]/.test(text)) return "ru"; // Russian
    if (/[\u0590-\u05ff]/.test(text)) return "he"; // Hebrew
    if (/[\u0600-\u06ff]/.test(text)) return "ar"; // Arabic

    // Default to English
    return "en";
  }

  // ─── MEMORY MANAGEMENT ─────────────────────────────────────

  /**
   * Clean up resources and free memory
   */
  public async cleanup(): Promise<void> {
    try {
      // Release TensorFlow Lite models
      if (this.objectDetectionModel) {
        // Note: react-native-fast-tflite doesn't expose explicit cleanup
        // Models are automatically cleaned up when garbage collected
        this.objectDetectionModel = null;
      }

      this.isInitialized = false;
      this.initializationPromise = null;

      console.log("PhotoAnalyzer: Cleanup completed");
    } catch (error) {
      console.error("PhotoAnalyzer: Cleanup failed:", error);
    }
  }

  // ─── UTILITIES ──────────────────────────────────────────────

  /**
   * Check if models are initialized and ready
   */
  public get isReady(): boolean {
    return this.isInitialized && this.objectDetectionModel !== null;
  }

  /**
   * Get model information for debugging
   */
  public getModelInfo(): { [key: string]: any } {
    return {
      isInitialized: this.isInitialized,
      objectDetectionModel: !!this.objectDetectionModel,
      mlVersion: ML_VERSION,
      platform: Platform.OS,
    };
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let photoAnalyzerInstance: PhotoAnalyzer | null = null;

/**
 * Get singleton instance of PhotoAnalyzer
 * Ensures only one ML model is loaded in memory
 */
export function getPhotoAnalyzer(): PhotoAnalyzer {
  if (!photoAnalyzerInstance) {
    photoAnalyzerInstance = new PhotoAnalyzer();
  }
  return photoAnalyzerInstance;
}

/**
 * Cleanup singleton instance
 * Call this when app is closing or memory is low
 */
export async function cleanupPhotoAnalyzer(): Promise<void> {
  if (photoAnalyzerInstance) {
    await photoAnalyzerInstance.cleanup();
    photoAnalyzerInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 * This function should only be used in tests to prevent memory leaks
 */
export function resetPhotoAnalyzerForTesting(): void {
  photoAnalyzerInstance = null;
}
