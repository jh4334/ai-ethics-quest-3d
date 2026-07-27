export function createDisposableRegistry() {
  const resources = new Map();

  return Object.freeze({
    disposeAll() {
      const pending = [...resources.entries()].reverse();
      resources.clear();
      for (const [resource] of pending) resource.dispose();
      return pending.length;
    },
    register(resource, id = `resource-${resources.size + 1}`) {
      if (!resource || typeof resource.dispose !== 'function') {
        throw new TypeError(`Disposable resource '${id}' requires dispose()`);
      }
      if (!resources.has(resource)) resources.set(resource, id);
      return resource;
    },
    size() {
      return resources.size;
    }
  });
}
