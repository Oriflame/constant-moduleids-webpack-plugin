/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Jan Novotny @ecl1ps
  Based on HashedModuleIdsPlugin of author Tobias Koppers @sokra
*/

/*
  In its basic form HashedModuleIdsPlugin and DeterministicModuleIdsPlugin both use Module.identifier() as a source for final moduleId.
  It is true that generated ids by these plugins are based on module name/path but it is not always only the module name.
  In some cases webpack internally creates a ConcatenatedModule for multiple internal modules for one main module
  and then _identifier_ contains something like "<module name>|<hash of all internal modules>".

  This id can change between multiple builds even when the version of some dependency (main module) doesn't change. It is probably
  caused by using different number of internal modules. And this volatility is a problem when the result bundle is used as a DLL with DLLReferencePlugin.
  Every consumer would have to rebuild its bundle every time the dll bundle would change (every change, even patch, would have to be treated as a breaking).

  This plugin replaces the use of Module.identifier() with Module.libIdent() (resp. getFullModuleName with getShortModuleName) which results
  in only the name of module being used. That way moduleIds never change and can be relied on.
*/

"use strict";

const {
  compareModulesByPreOrderIndexOrIdentifier,
} = require("webpack/lib/util/comparators");
const createSchemaValidation = require("webpack/lib/util/create-schema-validation");
const createHash = require("webpack/lib/util/createHash");
const {
  getUsedModuleIds,
  getShortModuleName,
} = require("webpack/lib/ids/IdHelpers");

/** @typedef {import("../../declarations/plugins/HashedModuleIdsPlugin").HashedModuleIdsPluginOptions} ConstantHashedModuleIdsPluginOptions */

const validate = createSchemaValidation(
  require("webpack/schemas/plugins/HashedModuleIdsPlugin.check"),
  () => require("webpack/schemas/plugins/HashedModuleIdsPlugin"),
  {
    name: "Constant Hashed Module Ids Plugin",
    baseDataPath: "options",
  }
);

class ConstantHashedModuleIdsPlugin {
  /**
   * @param {ConstantHashedModuleIdsPluginOptions=} options options object
   */
  constructor(options = {}) {
    validate(options);

    /** @type {ConstantHashedModuleIdsPluginOptions} */
    this.options = {
      context: null,
      hashFunction: "md4",
      hashDigest: "base64",
      hashDigestLength: 4,
      ...options,
    };
  }

  apply(compiler) {
    const options = this.options;
    compiler.hooks.compilation.tap(
      "ConstantHashedModuleIdsPlugin",
      (compilation) => {
        compilation.hooks.moduleIds.tap(
          "ConstantHashedModuleIdsPlugin",
          (modules) => {
            const chunkGraph = compilation.chunkGraph;
            const context = this.options.context
              ? this.options.context
              : compiler.context;

            const usedIds = getUsedModuleIds(compilation);
            const modulesInNaturalOrder = Array.from(modules)
              .filter((m) => {
                if (!m.needId) return false;
                if (chunkGraph.getNumberOfModuleChunks(m) === 0) return false;
                return chunkGraph.getModuleId(module) === null;
              })
              .sort(
                compareModulesByPreOrderIndexOrIdentifier(
                  compilation.moduleGraph
                )
              );
            for (const module of modulesInNaturalOrder) {
              const ident = getShortModuleName(module, context, compiler.root);
              const hash = createHash(options.hashFunction);
              hash.update(ident || "");
              const hashId = /** @type {string} */ (
                hash.digest(options.hashDigest)
              );
              let len = options.hashDigestLength;
              while (usedIds.has(hashId.substr(0, len))) len++;
              const moduleId = hashId.substr(0, len);
              chunkGraph.setModuleId(module, moduleId);
              usedIds.add(moduleId);
            }
          }
        );
      }
    );
  }
}

module.exports = ConstantHashedModuleIdsPlugin;
