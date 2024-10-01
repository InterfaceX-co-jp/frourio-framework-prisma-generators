#!/usr/bin/env node
import { generatorHandler } from '@prisma/generator-helper';
import { generate as generateDomainModel } from './generate';

generatorHandler({
  onManifest() {
    return {
      defaultOutput: '__generated__/models',
      prettyName: '[Frourio Framework]Models',
      version: '1.0.0',
    };
  },
  onGenerate: generateDomainModel,
});
