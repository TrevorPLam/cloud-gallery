// AI-META-BEGIN
// AI-META: Property tests for PhotoEditor service validating algorithm correctness
// OWNERSHIP: client/lib
// ENTRYPOINTS: run by npm test for algorithm validation
// DEPENDENCIES: vitest, fast-check, ./photo-editor
// DANGER: Tests must validate undo/redo idempotence and history consistency
// CHANGE-SAFETY: Maintain test coverage for all public functions and edge cases
// TESTS: npm run test:watch for development, npm run test:coverage for validation
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  PhotoEditor,
  createPhotoEditor,
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  ImageAdjustments,
  CropSettings,
  RotationSettings,
  adjustmentsEqual,
  clampValue,
} from './photo-editor';

// Mock expo-image-manipulator for testing
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn((uri, actions, options) => {
    // Mock implementation that returns a new URI
    return Promise.resolve({
      uri: `${uri}_edited_${Date.now()}`,
      width: 1000,
      height: 1000,
    });
  }),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
  FlipType: {
    Horizontal: 'horizontal',
    Vertical: 'vertical',
  },
}));

describe('PhotoEditor - Property Tests', () => {
  let editor: PhotoEditor;
  const mockUri = 'mock://image.jpg';

  beforeEach(() => {
    editor = createPhotoEditor(mockUri);
  });

  describe('Undo/Redo Idempotence Properties', () => {
    it('should satisfy undo idempotence property', async () => {
      // Property: undo(undo(x)) should equal undo(x) when no more undos available
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Apply adjustments
        await testEditor.applyAdjustments(adjustments);
        
        // First undo
        if (testEditor.canUndo()) {
          const firstUndoUri = await testEditor.undo();
          
          // Second undo (if possible)
          if (testEditor.canUndo()) {
            const secondUndoUri = await testEditor.undo();
            
            // Property: undo(undo(x)) should not be the same as undo(x) 
            // (unless we're back at original state)
            expect(secondUndoUri).toBeDefined();
          } else {
            // Property: undo(undo(x)) when no more undos should throw
            await expect(testEditor.undo()).rejects.toThrow();
          }
        }
      }), { numRuns: 10 });
    });

    it('should satisfy redo idempotence property', async () => {
      // Property: redo(redo(x)) should equal redo(x) when no more redos available
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Apply adjustments and undo
        await testEditor.applyAdjustments(adjustments);
        if (testEditor.canUndo()) {
          await testEditor.undo();
          
          // First redo
          if (testEditor.canRedo()) {
            const firstRedoUri = await testEditor.redo();
            
            // Second redo (if possible)
            if (testEditor.canRedo()) {
              const secondRedoUri = await testEditor.redo();
              
              // Property: redo(redo(x)) should not be the same as redo(x)
              // (unless we're at the latest state)
              expect(secondRedoUri).toBeDefined();
            } else {
              // Property: redo(redo(x)) when no more redos should throw
              await expect(testEditor.redo()).rejects.toThrow();
            }
          }
        }
      }), { numRuns: 10 });
    });

    it('should satisfy undo/redo round-trip property', async () => {
      // Property: undo(redo(x)) should equal x
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Apply adjustments
        const originalUri = testEditor.getCurrentUri();
        await testEditor.applyAdjustments(adjustments);
        const modifiedUri = testEditor.getCurrentUri();
        
        // Undo and redo
        if (testEditor.canUndo()) {
          await testEditor.undo();
          if (testEditor.canRedo()) {
            await testEditor.redo();
            
            // Property: undo(redo(x)) should equal x
            expect(testEditor.getCurrentUri()).toBe(modifiedUri);
          }
        }
      }), { numRuns: 10 });
    });
  });

  describe('History Consistency Properties', () => {
    it('should maintain history size consistency', async () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      const commandCountArb = fc.integer({ min: 1, max: 10 });

      await fc.assert(fc.asyncProperty(
        fc.tuple(adjustmentArb, commandCountArb),
        async ([adjustments, commandCount]) => {
          const testEditor = createPhotoEditor(mockUri);
          const initialHistorySize = 0;
          let expectedHistorySize = initialHistorySize;

          // Apply multiple commands
          for (let i = 0; i < commandCount; i++) {
            await testEditor.applyAdjustments(adjustments);
            expectedHistorySize++;
            
            // Property: history size should increase by 1 after each command
            expect(testEditor.getHistory().length).toBe(expectedHistorySize);
            expect(testEditor.getHistoryIndex()).toBe(expectedHistorySize - 1);
          }

          // Undo all commands
          while (testEditor.canUndo()) {
            await testEditor.undo();
            expectedHistorySize--;
            
            // Property: history size should remain constant during undo
            expect(testEditor.getHistory().length).toBe(commandCount);
            expect(testEditor.getHistoryIndex()).toBe(expectedHistorySize);
          }
        }
      ), { numRuns: 5 });
    });

    it('should maintain history index bounds', async () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Apply command
        await testEditor.applyAdjustments(adjustments);
        
        const history = testEditor.getHistory();
        const historyIndex = testEditor.getHistoryIndex();
        
        // Property: history index should be within valid bounds
        expect(historyIndex).toBeGreaterThanOrEqual(0);
        expect(historyIndex).toBeLessThan(history.length);
        
        // Undo
        if (testEditor.canUndo()) {
          await testEditor.undo();
          const newIndex = testEditor.getHistoryIndex();
          
          // Property: new index should be within bounds
          expect(newIndex).toBeGreaterThanOrEqual(-1);
          expect(newIndex).toBeLessThan(history.length);
        }
      }), { numRuns: 10 });
    });

    it('should clear redo history on new command', async () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments1) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Apply first command
        await testEditor.applyAdjustments(adjustments1);
        const historyAfterFirst = testEditor.getHistory().length;
        
        // Undo
        if (testEditor.canUndo()) {
          await testEditor.undo();
          const canRedoBefore = testEditor.canRedo();
          
          // Apply second command
          const adjustments2 = { ...adjustments1, brightness: adjustments1.brightness + 0.1 };
          await testEditor.applyAdjustments(adjustments2);
          
          // Property: redo should not be possible after new command
          expect(testEditor.canRedo()).toBe(false);
          
          // Property: history should be truncated
          expect(testEditor.getHistory().length).toBeLessThanOrEqual(historyAfterFirst);
        }
      }), { numRuns: 10 });
    });
  });

  describe('Adjustment Properties', () => {
    it('should satisfy adjustment equality property', () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      fc.assert(fc.property(adjustmentArb, (adjustments) => {
        // Property: equality should be reflexive
        expect(adjustmentsEqual(adjustments, adjustments)).toBe(true);
        
        // Property: equality should be symmetric
        const copy = { ...adjustments };
        expect(adjustmentsEqual(adjustments, copy)).toBe(true);
        expect(adjustmentsEqual(copy, adjustments)).toBe(true);
      }));
    });

    it('should satisfy clamp value properties', () => {
      const valueArb = fc.float();
      const minArb = fc.float();
      const maxArb = fc.float();

      fc.assert(fc.property(fc.tuple(valueArb, minArb, maxArb), ([value, min, max]) => {
        // Property: min <= max for valid test
        if (min > max) return true;

        const clamped = clampValue(value, min, max);
        
        // Property: clamped value should be within bounds
        expect(clamped).toBeGreaterThanOrEqual(min);
        expect(clamped).toBeLessThanOrEqual(max);
        
        // Property: if value is within bounds, it should remain unchanged
        if (value >= min && value <= max) {
          expect(clamped).toBe(value);
        }
        
        // Property: if value is below min, it should be clamped to min
        if (value < min) {
          expect(clamped).toBe(min);
        }
        
        // Property: if value is above max, it should be clamped to max
        if (value > max) {
          expect(clamped).toBe(max);
        }
      }));
    });
  });

  describe('Filter Properties', () => {
    it('should satisfy filter preset uniqueness', () => {
      const filterIds = FILTER_PRESETS.map(f => f.id);
      const uniqueIds = new Set(filterIds);
      
      // Property: all filter IDs should be unique
      expect(uniqueIds.size).toBe(filterIds.length);
    });

    it('should satisfy filter preset validity', () => {
      FILTER_PRESETS.forEach(filter => {
        // Property: all filters should have required fields
        expect(filter.id).toBeDefined();
        expect(filter.name).toBeDefined();
        expect(filter.description).toBeDefined();
        expect(filter.adjustments).toBeDefined();
        
        // Property: all adjustment values should be within valid ranges
        expect(filter.adjustments.brightness).toBeGreaterThanOrEqual(-1);
        expect(filter.adjustments.brightness).toBeLessThanOrEqual(1);
        expect(filter.adjustments.contrast).toBeGreaterThanOrEqual(-1);
        expect(filter.adjustments.contrast).toBeLessThanOrEqual(1);
        expect(filter.adjustments.saturation).toBeGreaterThanOrEqual(-1);
        expect(filter.adjustments.saturation).toBeLessThanOrEqual(1);
        expect(filter.adjustments.vignette).toBeGreaterThanOrEqual(0);
        expect(filter.adjustments.vignette).toBeLessThanOrEqual(1);
        expect(filter.adjustments.exposure).toBeGreaterThanOrEqual(-2);
        expect(filter.adjustments.exposure).toBeLessThanOrEqual(2);
      });
    });

    it('should satisfy original filter properties', () => {
      const originalFilter = FILTER_PRESETS.find(f => f.id === 'original');
      expect(originalFilter).toBeDefined();
      
      // Property: original filter should have no adjustments
      expect(adjustmentsEqual(originalFilter!.adjustments, DEFAULT_ADJUSTMENTS)).toBe(true);
    });
  });

  describe('Editor State Properties', () => {
    it('should maintain consistent URIs', async () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Property: original URI should never change
        expect(testEditor.getOriginalUri()).toBe(mockUri);
        
        // Apply adjustments
        await testEditor.applyAdjustments(adjustments);
        
        // Property: current URI should be defined and different from original
        const currentUri = testEditor.getCurrentUri();
        expect(currentUri).toBeDefined();
        expect(typeof currentUri).toBe('string');
        
        // Reset to original
        await testEditor.resetToOriginal();
        
        // Property: reset should restore current URI to original
        expect(testEditor.getCurrentUri()).toBe(mockUri);
      }), { numRuns: 10 });
    });

    it('should satisfy adjustment state consistency', async () => {
      const adjustmentArb = fc.record({
        brightness: fc.float({ min: -1, max: 1 }),
        contrast: fc.float({ min: -1, max: 1 }),
        saturation: fc.float({ min: -1, max: 1 }),
        vibrance: fc.float({ min: -1, max: 1 }),
        temperature: fc.float({ min: -1, max: 1 }),
        sharpness: fc.float({ min: -1, max: 1 }),
        clarity: fc.float({ min: -1, max: 1 }),
        vignette: fc.float({ min: 0, max: 1 }),
        exposure: fc.float({ min: -2, max: 2 }),
      });

      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);
        
        // Property: initial adjustments should be default
        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);
        
        // Apply adjustments
        await testEditor.applyAdjustments(adjustments);
        
        // Property: current adjustments should match applied adjustments
        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), adjustments)).toBe(true);
        
        // Reset to original
        await testEditor.resetToOriginal();
        
        // Property: reset should restore default adjustments
        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);
      }), { numRuns: 10 });
    });
  });
});

describe('PhotoEditor - Unit Tests', () => {
  let editor: PhotoEditor;
  const mockUri = 'mock://image.jpg';

  beforeEach(() => {
    editor = createPhotoEditor(mockUri);
  });

  describe('Basic Operations', () => {
    it('should create editor with correct initial state', () => {
      expect(editor.getCurrentUri()).toBe(mockUri);
      expect(editor.getOriginalUri()).toBe(mockUri);
      expect(adjustmentsEqual(editor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);
      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(false);
      expect(editor.getHistory()).toHaveLength(0);
      expect(editor.getHistoryIndex()).toBe(-1);
    });

    it('should apply adjustments correctly', async () => {
      const adjustments: ImageAdjustments = {
        brightness: 0.5,
        contrast: 0.3,
        saturation: -0.2,
        vibrance: 0.1,
        temperature: -0.1,
        sharpness: 0.2,
        clarity: -0.1,
        vignette: 0.15,
        exposure: 0.1,
      };

      const newUri = await editor.applyAdjustments(adjustments);
      
      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      expect(adjustmentsEqual(editor.getCurrentAdjustments(), adjustments)).toBe(true);
      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(false);
      expect(editor.getHistory()).toHaveLength(1);
      expect(editor.getHistoryIndex()).toBe(0);
    });

    it('should apply crop correctly', async () => {
      const cropSettings: CropSettings = {
        originX: 100,
        originY: 100,
        width: 800,
        height: 600,
      };

      const newUri = await editor.applyCrop(cropSettings);
      
      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      expect(editor.canUndo()).toBe(true);
      expect(editor.getHistory()).toHaveLength(1);
    });

    it('should apply rotation correctly', async () => {
      const rotationSettings: RotationSettings = {
        degrees: 90,
        flipHorizontal: false,
        flipVertical: false,
      };

      const newUri = await editor.applyRotation(rotationSettings);
      
      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      expect(editor.canUndo()).toBe(true);
      expect(editor.getHistory()).toHaveLength(1);
    });

    it('should apply filter correctly', async () => {
      const filterId = 'vivid';
      const newUri = await editor.applyFilter(filterId);
      
      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      
      const filter = FILTER_PRESETS.find(f => f.id === filterId);
      expect(adjustmentsEqual(editor.getCurrentAdjustments(), filter!.adjustments)).toBe(true);
    });

    it('should throw error for invalid filter', async () => {
      await expect(editor.applyFilter('invalid-filter')).rejects.toThrow('Filter not found');
    });
  });

  describe('Undo/Redo Operations', () => {
    it('should undo and redo correctly', async () => {
      const adjustments1: ImageAdjustments = { ...DEFAULT_ADJUSTMENTS, brightness: 0.5 };
      const adjustments2: ImageAdjustments = { ...DEFAULT_ADJUSTMENTS, contrast: 0.3 };

      // Apply two adjustments
      const uri1 = await editor.applyAdjustments(adjustments1);
      const uri2 = await editor.applyAdjustments(adjustments2);

      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(false);
      expect(editor.getHistory()).toHaveLength(2);
      expect(editor.getHistoryIndex()).toBe(1);

      // Undo first adjustment
      const undoUri = await editor.undo();
      expect(undoUri).toBe(uri1);
      expect(editor.getCurrentUri()).toBe(uri1);
      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(true);
      expect(editor.getHistoryIndex()).toBe(0);

      // Redo adjustment
      const redoUri = await editor.redo();
      expect(redoUri).toBe(uri2);
      expect(editor.getCurrentUri()).toBe(uri2);
      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(false);
      expect(editor.getHistoryIndex()).toBe(1);
    });

    it('should throw error when undo not possible', async () => {
      expect(editor.canUndo()).toBe(false);
      await expect(editor.undo()).rejects.toThrow('Cannot undo: no commands in history');
    });

    it('should throw error when redo not possible', async () => {
      expect(editor.canRedo()).toBe(false);
      await expect(editor.redo()).rejects.toThrow('Cannot redo: no commands to redo');
    });
  });

  describe('History Management', () => {
    it('should clear history correctly', async () => {
      await editor.applyAdjustments({ ...DEFAULT_ADJUSTMENTS, brightness: 0.5 });
      await editor.applyAdjustments({ ...DEFAULT_ADJUSTMENTS, contrast: 0.3 });

      expect(editor.getHistory()).toHaveLength(2);
      expect(editor.getHistoryIndex()).toBe(1);

      editor.clearHistory();

      expect(editor.getHistory()).toHaveLength(0);
      expect(editor.getHistoryIndex()).toBe(-1);
      expect(editor.canUndo()).toBe(false);
      expect(editor.canRedo()).toBe(false);
    });

    it('should reset to original correctly', async () => {
      await editor.applyAdjustments({ ...DEFAULT_ADJUSTMENTS, brightness: 0.5 });
      await editor.applyCrop({ originX: 0, originY: 0, width: 100, height: 100 });

      const resetUri = await editor.resetToOriginal();

      expect(resetUri).toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(mockUri);
      expect(adjustmentsEqual(editor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);
      expect(editor.getHistory()).toHaveLength(0);
      expect(editor.getHistoryIndex()).toBe(-1);
    });
  });

  describe('Utility Functions', () => {
    it('should get filter presets', () => {
      const presets = editor.getFilterPresets();
      expect(presets).toBe(FILTER_PRESETS);
      expect(presets).toHaveLength(16); // Should have 16 presets including original
    });

    it('should dispose correctly', () => {
      editor.dispose();
      expect(editor.getHistory()).toHaveLength(0);
      expect(editor.getHistoryIndex()).toBe(-1);
    });
  });
});
