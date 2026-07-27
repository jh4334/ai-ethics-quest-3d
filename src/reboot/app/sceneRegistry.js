const SCENE_METHODS = ['enter', 'update', 'exit', 'dispose'];

export function createSceneRegistry(entries) {
  const factories = new Map();

  for (const [id, factory] of entries) {
    if (typeof id !== 'string' || id.length === 0 || typeof factory !== 'function') {
      throw new TypeError('Scene registry entries require a non-empty id and factory');
    }
    if (factories.has(id)) throw new Error(`Duplicate scene id: ${id}`);
    factories.set(id, factory);
  }

  return Object.freeze({
    create(id) {
      const factory = factories.get(id);
      if (!factory) throw new Error(`Unknown scene id: ${id}`);
      const scene = factory();
      const missing = SCENE_METHODS.filter((method) => typeof scene?.[method] !== 'function');
      if (missing.length > 0) {
        throw new TypeError(`Scene contract requires enter, update, exit, dispose; missing: ${missing.join(', ')}`);
      }
      return scene;
    },
    has(id) {
      return factories.has(id);
    },
    list() {
      return [...factories.keys()].sort();
    }
  });
}
