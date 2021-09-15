/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Jan Novotny @ecl1ps
  Based on HashedModuleIdsPlugin of author Tobias Koppers @sokra
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
