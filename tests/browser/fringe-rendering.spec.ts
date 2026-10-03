import { expect, test } from "@playwright/test";

test("detector pixels respect translation, scale, clipping and opacity", async ({ page }) => {
  await page.goto("/?screens=1&ea");
  await page.waitForSelector("#sim");

  const pixels = await page.evaluate(async () => {
    // Import through Vite after the simulation's bootstrap has initialized SceneryStack.
    const rendererPath = "/src/common/view/FringePatternNode.ts";
    const modelPath = "/src/michelson/model/MichelsonModel.ts";
    const sourcePath = "/src/common/model/SourceType.ts";
    const { FringePatternNode } = await import(rendererPath);
    const { MichelsonModel } = await import(modelPath);
    const { SourceType } = await import(sourcePath);
    const model = new MichelsonModel();
    model.zeroTheArms();
    const detector = new FringePatternNode(model.fringeSpecProperty, { size: 32 });

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No 2D context");
    }
    context.translate(40, 30);
    context.scale(2, 2);
    context.beginPath();
    context.rect(0, 0, 16, 32);
    context.clip();
    context.globalAlpha = 0.5;
    context.imageSmoothingEnabled = false;

    const sample = (x: number, y: number): number[] => Array.from(context.getImageData(x, y, 1, 1).data);
    const results = [];
    // Changing source also reallocates the renderer's monochromatic/broadband buffer.
    for (const source of [SourceType.HELIUM_NEON, SourceType.WHITE_LIGHT, SourceType.HELIUM_NEON]) {
      model.lightSource.sourceTypeProperty.value = source;
      detector.paintCanvas(context);
      results.push({
        origin: sample(0, 0),
        inside: sample(50, 80),
        clipped: sample(90, 80),
        beyond: sample(50, 100),
        opacity: context.globalAlpha,
        smoothing: context.imageSmoothingEnabled,
      });
      context.save();
      context.resetTransform();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }
    detector.dispose();
    return results;
  });

  for (const result of pixels) {
    expect(result.origin).toEqual([0, 0, 0, 0]);
    expect(result.inside[0]).toBeGreaterThan(200);
    expect(result.inside[3]).toBeCloseTo(128, 0);
    expect(result.clipped).toEqual([0, 0, 0, 0]);
    expect(result.beyond).toEqual([0, 0, 0, 0]);
    expect(result.opacity).toBe(0.5);
    expect(result.smoothing).toBe(false);
  }
});
