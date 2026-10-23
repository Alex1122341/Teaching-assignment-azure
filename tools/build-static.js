'use strict';

const path = require('node:path');
const { ROOT } = require('./build/frontend-paths');
const { buildStaticBundle } = require('./build/static-bundle');

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--output requires a directory.');
const output = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : path.join(ROOT, '.deploy-static'));
if (output !== path.join(ROOT, '.deploy-static')) {
  throw new Error('Static build output must be the repository .deploy-static directory.');
}

console.log(JSON.stringify(buildStaticBundle({ root: ROOT, output })));
