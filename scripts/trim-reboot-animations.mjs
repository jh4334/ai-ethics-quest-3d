import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { ANIMATION_ASSETS, CHARACTER_ROSTER } from '../src/reboot/characters/catalog.js';

const io = new NodeIO();

function animationFile(assetPath) {
  return fileURLToPath(new URL(`../public/${assetPath.replace('./', '')}`, import.meta.url));
}

function requiredClips(library) {
  return new Set(Object.values(CHARACTER_ROSTER)
    .filter((profile) => profile.identity.kind === 'human' && profile.library === library)
    .flatMap((profile) => Object.values(profile.animations)));
}

function disposeAnimation(animation) {
  for (const channel of animation.listChannels()) channel.dispose();
  for (const sampler of animation.listSamplers()) sampler.dispose();
  animation.dispose();
}

function disposeDetachedAnimationProperties(document) {
  const root = document.getRoot();
  const graph = document.getGraph();
  const liveAnimations = root.listAnimations();
  const liveChannels = new Set(liveAnimations.flatMap((animation) => animation.listChannels()));
  const liveSamplers = new Set(liveAnimations.flatMap((animation) => animation.listSamplers()));
  const channels = new Set(root.listNodes().flatMap((node) => (
    graph.listParents(node).filter((parent) => parent.propertyType === 'AnimationChannel')
  )));
  const samplers = new Set(root.listAccessors().flatMap((accessor) => (
    graph.listParents(accessor).filter((parent) => parent.propertyType === 'AnimationSampler')
  )));
  for (const channel of channels) {
    if (!liveChannels.has(channel)) channel.dispose();
  }
  for (const sampler of samplers) {
    if (!liveSamplers.has(sampler)) sampler.dispose();
  }
}

async function trimLibrary(library, assetPath) {
  const path = animationFile(assetPath);
  const before = (await stat(path)).size;
  const document = await io.read(path);
  const required = requiredClips(library);
  const animations = document.getRoot().listAnimations();
  const available = new Set(animations.map((animation) => animation.getName()));
  const missing = [...required].filter((clip) => !available.has(clip));
  if (missing.length > 0) throw new Error(`${library} 필수 애니메이션 누락: ${missing.join(', ')}`);

  for (const animation of animations) {
    if (!required.has(animation.getName())) disposeAnimation(animation);
  }
  disposeDetachedAnimationProperties(document);
  await document.transform(prune());
  await io.write(path, document);
  const after = (await stat(path)).size;
  return Object.freeze({ after, before, clips: Object.freeze([...required].sort()), library, path: assetPath });
}

const results = [];
for (const [library, assetPath] of Object.entries(ANIMATION_ASSETS)) {
  results.push(await trimLibrary(library, assetPath));
}
console.log(JSON.stringify({ results }, null, 2));
