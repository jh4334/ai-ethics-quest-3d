export const VIEWPORT_FIXTURES = Object.freeze({
  landscape: Object.freeze({ height: 820, width: 1180 }),
  portrait: Object.freeze({ height: 844, width: 390 }),
  touch: Object.freeze({ height: 720, width: 390 })
});

export function applyViewportFixture({ canvas, name, root }) {
  const viewport = VIEWPORT_FIXTURES[name];
  if (!viewport) return false;
  root.dataset.touchMode = name === 'landscape' ? 'false' : 'true';
  root.dataset.viewportFixture = name;
  root.style.setProperty('--fixture-width', `${viewport.width}px`);
  root.style.width = `${viewport.width}px`;
  root.style.height = `${viewport.height}px`;
  root.style.minHeight = `${viewport.height}px`;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  return true;
}

export function configureRuntime({ canvas, root, savedSettings, searchParams, testHook }) {
  if (testHook) applyViewportFixture({ canvas, name: searchParams.get('viewport'), root });
  return Object.freeze({
    motion: testHook && searchParams.get('motion') === 'reduced' ? 'reduced' : savedSettings.motion,
    quality: testHook && ['low', 'medium', 'high'].includes(searchParams.get('quality'))
      ? searchParams.get('quality') : savedSettings.quality,
    sound: testHook && searchParams.get('sound') === 'off' ? false : savedSettings.sound
  });
}

export function withRuntimeSettings(campaign, settings) {
  return { ...campaign, settings };
}
