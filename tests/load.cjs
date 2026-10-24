const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
exports.load = (name, mocks = {}, extra = {}) => {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: id => { if (id in mocks) return mocks[id]; throw new Error(`Unmocked module: ${id}`); }, setTimeout, clearTimeout, URL, Request, Response, TextEncoder, AbortController, console, ...extra };
  vm.runInNewContext(output, context, { filename: name });
  return module.exports;
};
