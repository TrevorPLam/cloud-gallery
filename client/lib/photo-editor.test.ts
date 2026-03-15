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

// ─────────────────────────────────────────────────────────
// FIX 1: mockManipulateAsync must be declared before vi.mock() so the
// factory closure captures the same reference used in the call sites.
// Previously the declaration was AFTER the mock, which works in CJS but
// causes a TDZ ReferenceError under Vitest's ESM transform.
// ─────────────────────────────────────────────────────────
const mockManipulateAsync = vi.fn((uri: string) =>
  Promise.resolve({ uri: `${uri}_processed`, width: 1000, height: 1000 }),
);

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: mockManipulateAsync,
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  FlipType: { Horizontal: 'horizontal', Vertical: 'vertical' },
}));

// ─────────────────────────────────────────────────────────
// Shared arbitraries — extracted so each test doesn't duplicate
// the full record definition (the original repeated it 12 times).
// ─────────────────────────────────────────────────────────
const adjustmentArb = fc.record({
  brightness:  fc.float({ min: -1, max: 1 }),
  contrast:    fc.float({ min: -1, max: 1 }),
  saturation:  fc.float({ min: -1, max: 1 }),
  vibrance:    fc.float({ min: -1, max: 1 }),
  temperature: fc.float({ min: -1, max: 1 }),
  sharpness:   fc.float({ min: -1, max: 1 }),
  clarity:     fc.float({ min: -1, max: 1 }),
  vignette:    fc.float({ min: 0,  max: 1 }),
  exposure:    fc.float({ min: -2, max: 2 }),
});

describe('PhotoEditor - Property Tests', () => {
  let editor: PhotoEditor;
  const mockUri = 'mock://image.jpg';

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire after clearAllMocks so the mock still returns a uri string.
    mockManipulateAsync.mockImplementation((uri: string) =>
      Promise.resolve({ uri: `${uri}_processed`, width: 1000, height: 1000 }),
    );
    editor = createPhotoEditor(mockUri);
  });

  describe('Undo/Redo Idempotence Properties', () => {
    it('should satisfy undo idempotence property', async () => {
      // FIX 2: fc.assert() with an asyncProperty returns a Promise.
      // The original code wrote `const property = fc.assert(...); expect(property).resolves...`
      // which schedules the assertion but never awaits the inner Promise properly — the
      // test passes trivially because the outer await never throws. The fix is to await
      // fc.assert() directly; if the property fails, it throws synchronously in the
      // awaited micro-task and the test fails correctly.
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        await testEditor.applyAdjustments(adjustments);

        if (testEditor.canUndo()) {
          const firstUndoUri = await testEditor.undo();
          expect(firstUndoUri).toBeDefined();

          if (testEditor.canUndo()) {
            const secondUndoUri = await testEditor.undo();
            expect(secondUndoUri).toBeDefined();
          } else {
            // No more undos — next call must throw.
            await expect(testEditor.undo()).rejects.toThrow();
          }
        }
      }), { numRuns: 10 });
    });

    it('should satisfy redo idempotence property', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        await testEditor.applyAdjustments(adjustments);
        if (testEditor.canUndo()) {
          await testEditor.undo();

          if (testEditor.canRedo()) {
            const firstRedoUri = await testEditor.redo();
            expect(firstRedoUri).toBeDefined();

            if (testEditor.canRedo()) {
              const secondRedoUri = await testEditor.redo();
              expect(secondRedoUri).toBeDefined();
            } else {
              await expect(testEditor.redo()).rejects.toThrow();
            }
          }
        }
      }), { numRuns: 10 });
    });

    it('should satisfy undo/redo round-trip property', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        await testEditor.applyAdjustments(adjustments);
        const modifiedUri = testEditor.getCurrentUri();

        if (testEditor.canUndo()) {
          await testEditor.undo();
          if (testEditor.canRedo()) {
            await testEditor.redo();
            // undo(redo(x)) === x
            expect(testEditor.getCurrentUri()).toBe(modifiedUri);
          }
        }
      }), { numRuns: 10 });
    });
  });

  describe('History Consistency Properties', () => {
    it('should maintain history size consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.tuple(adjustmentArb, fc.integer({ min: 1, max: 10 })),
        async ([adjustments, commandCount]) => {
          const testEditor = createPhotoEditor(mockUri);
          let expectedHistorySize = 0;

          for (let i = 0; i < commandCount; i++) {
            await testEditor.applyAdjustments(adjustments);
            expectedHistorySize++;

            expect(testEditor.getHistory().length).toBe(expectedHistorySize);
            expect(testEditor.getHistoryIndex()).toBe(expectedHistorySize - 1);
          }

          while (testEditor.canUndo()) {
            await testEditor.undo();
            expectedHistorySize--;

            // History array length stays constant during undo (items aren't deleted).
            expect(testEditor.getHistory().length).toBe(commandCount);
            expect(testEditor.getHistoryIndex()).toBe(expectedHistorySize);
          }
        },
      ), { numRuns: 5 });
    });

    it('should maintain history index bounds', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        await testEditor.applyAdjustments(adjustments);

        const history      = testEditor.getHistory();
        const historyIndex = testEditor.getHistoryIndex();

        expect(historyIndex).toBeGreaterThanOrEqual(0);
        expect(historyIndex).toBeLessThan(history.length);

        if (testEditor.canUndo()) {
          await testEditor.undo();
          const newIndex = testEditor.getHistoryIndex();

          expect(newIndex).toBeGreaterThanOrEqual(-1);
          expect(newIndex).toBeLessThan(history.length);
        }
      }), { numRuns: 10 });
    });

    it('should clear redo history on new command', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments1) => {
        const testEditor = createPhotoEditor(mockUri);

        await testEditor.applyAdjustments(adjustments1);
        const historyAfterFirst = testEditor.getHistory().length;

        if (testEditor.canUndo()) {
          await testEditor.undo();

          // Apply a second, slightly different command.
          const adjustments2 = { ...adjustments1, brightness: adjustments1.brightness + 0.1 };
          await testEditor.applyAdjustments(adjustments2);

          expect(testEditor.canRedo()).toBe(false);
          expect(testEditor.getHistory().length).toBeLessThanOrEqual(historyAfterFirst);
        }
      }), { numRuns: 10 });
    });
  });

  describe('Adjustment Properties', () => {
    it('should satisfy adjustment equality property', () => {
      // FIX 3: synchronous fc.assert() with fc.property() (not asyncProperty)
      // must NOT be awaited — it returns void in fast-check v3. The original
      // wrapped it in `const property = fc.assert(...); expect(property).resolves...`
      // which silently passed. Drop the wrapper and call fc.assert directly.
      fc.assert(fc.property(adjustmentArb, (adjustments) => {
        expect(adjustmentsEqual(adjustments, adjustments)).toBe(true);

        const copy = { ...adjustments };
        expect(adjustmentsEqual(adjustments, copy)).toBe(true);
        expect(adjustmentsEqual(copy, adjustments)).toBe(true);
      }));
    });

    it('should satisfy clamp value properties', () => {
      fc.assert(fc.property(
        fc.tuple(fc.float(), fc.float(), fc.float()),
        ([value, min, max]) => {
          if (min > max) return; // skip invalid range

          const clamped = clampValue(value, min, max);

          expect(clamped).toBeGreaterThanOrEqual(min);
          expect(clamped).toBeLessThanOrEqual(max);

          if (value >= min && value <= max) expect(clamped).toBe(value);
          if (value < min)                 expect(clamped).toBe(min);
          if (value > max)                 expect(clamped).toBe(max);
        },
      ));
    });
  });

  describe('Filter Properties', () => {
    it('should satisfy filter preset uniqueness', () => {
      const filterIds  = FILTER_PRESETS.map(f => f.id);
      const uniqueIds  = new Set(filterIds);
      expect(uniqueIds.size).toBe(filterIds.length);
    });

    it('should satisfy filter preset validity', () => {
      FILTER_PRESETS.forEach(filter => {
        expect(filter.id).toBeDefined();
        expect(filter.name).toBeDefined();
        expect(filter.description).toBeDefined();
        expect(filter.adjustments).toBeDefined();

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
      expect(adjustmentsEqual(originalFilter!.adjustments, DEFAULT_ADJUSTMENTS)).toBe(true);
    });
  });

  describe('Editor State Properties', () => {
    it('should maintain consistent URIs', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        expect(testEditor.getOriginalUri()).toBe(mockUri);

        await testEditor.applyAdjustments(adjustments);

        const currentUri = testEditor.getCurrentUri();
        expect(currentUri).toBeDefined();
        expect(typeof currentUri).toBe('string');

        await testEditor.resetToOriginal();
        expect(testEditor.getCurrentUri()).toBe(mockUri);
      }), { numRuns: 10 });
    });

    it('should satisfy adjustment state consistency', async () => {
      await fc.assert(fc.asyncProperty(adjustmentArb, async (adjustments) => {
        const testEditor = createPhotoEditor(mockUri);

        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);

        await testEditor.applyAdjustments(adjustments);
        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), adjustments)).toBe(true);

        await testEditor.resetToOriginal();
        expect(adjustmentsEqual(testEditor.getCurrentAdjustments(), DEFAULT_ADJUSTMENTS)).toBe(true);
      }), { numRuns: 10 });
    });
  });
});

// ─────────────────────────────────────────────────────────
// Unit Tests
// ─────────────────────────────────────────────────────────

describe('PhotoEditor - Unit Tests', () => {
  let editor: PhotoEditor;
  const mockUri = 'mock://image.jpg';

  beforeEach(() => {
    vi.clearAllMocks();
    mockManipulateAsync.mockImplementation((uri: string) =>
      Promise.resolve({ uri: `${uri}_processed`, width: 1000, height: 1000 }),
    );
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
        brightness:  0.5,
        contrast:    0.3,
        saturation: -0.2,
        vibrance:    0.1,
        temperature:-0.1,
        sharpness:   0.2,
        clarity:    -0.1,
        vignette:    0.15,
        exposure:    0.1,
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
      const cropSettings: CropSettings = { originX: 100, originY: 100, width: 800, height: 600 };

      const newUri = await editor.applyCrop(cropSettings);

      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      expect(editor.canUndo()).toBe(true);
      expect(editor.getHistory()).toHaveLength(1);
    });

    it('should apply rotation correctly', async () => {
      const rotationSettings: RotationSettings = { degrees: 90, flipHorizontal: false, flipVertical: false };

      const newUri = await editor.applyRotation(rotationSettings);

      expect(newUri).toBeDefined();
      expect(newUri).not.toBe(mockUri);
      expect(editor.getCurrentUri()).toBe(newUri);
      expect(editor.canUndo()).toBe(true);
      expect(editor.getHistory()).toHaveLength(1);
    });

    it('should apply filter correctly', async () => {
      const filterId = 'vivid';
      const newUri   = await editor.applyFilter(filterId);

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

      const uri1 = await editor.applyAdjustments(adjustments1);
      const uri2 = await editor.applyAdjustments(adjustments2);

      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(false);
      expect(editor.getHistory()).toHaveLength(2);
      expect(editor.getHistoryIndex()).toBe(1);

      const undoUri = await editor.undo();
      expect(undoUri).toBe(uri1);
      expect(editor.getCurrentUri()).toBe(uri1);
      expect(editor.canUndo()).toBe(true);
      expect(editor.canRedo()).toBe(true);
      expect(editor.getHistoryIndex()).toBe(0);

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
      expect(presets).toStrictEqual(FILTER_PRESETS);
      expect(presets).toHaveLength(16);
    });

    it('should dispose correctly', () => {
      editor.dispose();
      expect(editor.getHistory()).toHaveLength(0);
      expect(editor.getHistoryIndex()).toBe(-1);
    });
  });
});