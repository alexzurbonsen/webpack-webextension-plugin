"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebextensionPlugin = void 0;
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const ws_1 = __importDefault(require("ws"));
const webpack_1 = __importStar(require("webpack"));
const mustache_1 = __importDefault(require("mustache"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const vendors_json_1 = __importDefault(require("./vendors.json"));
const manifest_1 = require("./manifest");
const jsonc_parser_1 = require("jsonc-parser");
const { WebpackError } = webpack_1.default;
class WebextensionPlugin {
    port;
    host;
    autoreload;
    reconnectTime;
    vendor;
    manifestDefaults;
    quiet;
    skipManifestValidation;
    server;
    isWatching;
    manifestChanged;
    clientAdded;
    startTime;
    readFile;
    sources;
    cleanPlugin;
    // eslint-disable-next-line no-unused-vars
    notifyExtension;
    client;
    vendors;
    backgroundPagePathDefault;
    manifestNameDefault;
    constructor({ port = 35729, host = "localhost", reconnectTime = 3000, autoreload = true, vendor = "chrome", manifestDefaults = {}, quiet = false, skipManifestValidation = false, } = {}) {
        // Apply Settings
        this.port = port;
        this.host = host;
        this.autoreload = autoreload;
        this.reconnectTime = reconnectTime;
        this.vendor = vendor;
        this.manifestDefaults = manifestDefaults;
        this.quiet = quiet;
        this.skipManifestValidation = skipManifestValidation;
        // Set some defaults
        this.server = null;
        this.isWatching = false;
        this.manifestChanged = true;
        this.clientAdded = false;
        this.startTime = Date.now();
        this.vendors = vendors_json_1.default;
        this.backgroundPagePathDefault = "webextension-toolbox/background_page.js";
        this.manifestNameDefault = "manifest.json";
        this.notifyExtension = () => { };
    }
    /**
     * Install plugin (install hooks)
     *
     * @param compiler Compiler
     */
    apply(compiler) {
        const { name } = this.constructor;
        const { inputFileSystem } = compiler;
        if (inputFileSystem !== null) {
            this.readFile = (0, util_1.promisify)(inputFileSystem.readFile.bind(inputFileSystem));
        }
        this.sources = compiler.webpack.sources;
        this.cleanPlugin = compiler.webpack.CleanPlugin;
        compiler.hooks.watchRun.tapPromise(name, this.watchRun.bind(this));
        compiler.hooks.compilation.tap(name, this.compilation.bind(this));
        compiler.hooks.make.tapPromise(name, this.make.bind(this));
        compiler.hooks.afterCompile.tap(name, this.afterCompile.bind(this));
        compiler.hooks.done.tap(name, this.done.bind(this));
    }
    /**
     * Webpack watchRun hook
     *
     * @param compiler Compiler
     */
    watchRun(compiler) {
        this.isWatching = true;
        this.detectManifestModification(compiler);
        return this.startServer();
    }
    /**
     * Webpack compilation hook
     *
     * @param {Object} compilation
     */
    compilation(compilation) {
        this.injectServiceWorkerClient(compilation);
        this.keepFiles(compilation);
    }
    /**
     * Inject Service Worker Client into the current server_worker
     * @param compilation
     */
    injectServiceWorkerClient(compilation) {
        // Locate the service worker
        const manifestPath = path_1.default.join(compilation.options.context ?? "", this.manifestNameDefault);
        const manifestBuffer = (0, fs_1.readFileSync)(manifestPath, {
            encoding: "utf8",
        });
        const manifest = JSON.parse((0, jsonc_parser_1.stripComments)(manifestBuffer));
        const serviceWorker = manifest?.background?.service_worker ?? null;
        if (serviceWorker !== null &&
            this.autoreload &&
            this.isWatching &&
            !this.clientAdded) {
            const { name } = this.constructor;
            compilation.hooks.processAssets.tap({
                name,
                stage: webpack_1.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
            }, (assets) => {
                if (assets[serviceWorker]) {
                    const source = (0, fs_1.readFileSync)(path_1.default.resolve(__dirname, "service_worker.js"), {
                        encoding: "utf8",
                    });
                    const replacedSource = mustache_1.default.render(source.toString(), {
                        port: this.port,
                        host: this.host,
                        reconnectTime: this.reconnectTime,
                    });
                    compilation.updateAsset(serviceWorker, (old) => new this.sources.RawSource(`${replacedSource}\n${old.source()}`));
                }
            });
        }
    }
    /**
     * Webpack make hook
     *
     * @param compilation Compilation
     */
    make(compilation) {
        return Promise.all([this.addManifest(compilation)]).then(() => { });
    }
    /**
     * Webpack afteCompile hook
     *
     * @param compilation Compilation
     */
    afterCompile(compilation) {
        return this.watchManifest(compilation);
    }
    /**
     * Add manifest to the filesDependencies
     *
     * @param compilation Compilation
     */
    watchManifest(compilation) {
        if (!compilation.options.context) {
            return;
        }
        compilation.fileDependencies.add(path_1.default.join(compilation.options.context, this.manifestNameDefault));
    }
    /**
     * Webpack done hook
     *
     * @param stats Stats
     */
    done(stats) {
        this.reloadExtensions(stats);
    }
    /**
     * Prevents deletion of manifest.json and background_page.js files by clean plugin
     *
     * @param compilation Compilation
     */
    keepFiles(compilation) {
        if (this.cleanPlugin) {
            this.cleanPlugin
                .getCompilationHooks(compilation)
                .keep.tap(this.constructor.name, (asset) => asset === this.manifestNameDefault ||
                (asset === this.backgroundPagePathDefault &&
                    this.autoreload &&
                    this.isWatching));
        }
    }
    /**
     * Detect changed files
     *
     * @param compiler Compiler
     */
    detectManifestModification(compiler) {
        if (compiler.modifiedFiles && compiler.options.context) {
            const manifestFile = path_1.default.join(compiler.options.context, this.manifestNameDefault);
            this.manifestChanged = compiler.modifiedFiles.has(manifestFile);
        }
    }
    /**
     * Start websocket server
     * on watch mode
     */
    startServer() {
        return new Promise((resolve, reject) => {
            if (!this.autoreload || !this.isWatching || this.server) {
                resolve();
                return;
            }
            const { host, port } = this;
            this.server = new ws_1.default.Server({ port }, () => {
                this.log(`listens on ws://${host}:${port}`);
                resolve();
            });
            this.server.on("error", reject);
            this.notifyExtension = (data) => {
                this.server.clients.forEach((client) => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            };
        });
    }
    /**
     * Namespaced logger
     */
    log(...optionalParams) {
        if (!this.quiet) {
            console.log("webpack-webextension-plugin", ...optionalParams);
        }
    }
    /**
     * Add the client script to assets
     * when autoreload enabled and is watching
     *
     * @param compilation Compilation
     */
    async addClient(compilation) {
        if (this.autoreload && this.isWatching && !this.clientAdded) {
            // Add client to extension. We will includes this
            // as a background script in the manifest.json later.
            const client = await this.compileClient();
            compilation.emitAsset(this.backgroundPagePathDefault, new this.sources.RawSource(client));
            this.clientAdded = true;
        }
    }
    /**
     * Compile the client only once
     * and add it to the assets output
     */
    async compileClient() {
        // Only compile client once
        if (this.client)
            return this.client;
        // Get the client as string
        const clientPath = path_1.default.resolve(__dirname, "background_page.js");
        const clientBuffer = await this.readFile(clientPath);
        // Inject settings
        this.client = mustache_1.default.render(clientBuffer.toString(), {
            port: this.port,
            host: this.host,
            reconnectTime: this.reconnectTime,
        });
        return this.client;
    }
    /**
     * Compile manifest and add it
     * to the asset ouput
     *
     * @param compilation Compilation
     */
    async addManifest(compilation) {
        if (this.manifestChanged) {
            if (!compilation.options.context) {
                return;
            }
            // Load manifest
            const manifestPath = path_1.default.join(compilation.options.context, this.manifestNameDefault);
            const manifestBuffer = (0, fs_1.readFileSync)(manifestPath, {
                encoding: "utf8",
            });
            let manifest;
            // Convert to JSON
            try {
                manifest = JSON.parse((0, jsonc_parser_1.stripComments)(manifestBuffer));
            }
            catch (error) {
                throw new Error(`Could not parse ${this.manifestNameDefault}`);
            }
            manifest = {
                ...this.manifestDefaults,
                ...manifest,
            };
            // Transform __chrome__key -> key
            manifest = (0, manifest_1.transformManifestVendorKeys)(manifest, this.vendor);
            // Transform ENV Values
            manifest = (0, manifest_1.transformManifestValuesFromENV)(manifest);
            // Validate manifest.json syntax
            if (!this.skipManifestValidation) {
                const errors = (0, manifest_1.validateManifest)(manifest);
                if (errors !== null) {
                    errors.forEach((error) => {
                        const webpackError = new WebpackError(`${error.dataPath} ${error.message}`);
                        webpackError.file = manifestPath;
                        webpackError.details = JSON.stringify(error, null, 2);
                        compilation.errors.push(webpackError);
                    });
                }
            }
            // Add client
            if (this.autoreload && this.isWatching) {
                manifest = await this.addBackgroundscript(manifest, compilation);
            }
            // Create webpack file entry
            const manifestStr = JSON.stringify(manifest, null, 2);
            compilation.emitAsset(this.manifestNameDefault, new this.sources.RawSource(manifestStr));
        }
    }
    /**
     * Send message to extensions with
     * changed files
     *
     * @param stats Stats
     */
    reloadExtensions(stats) {
        // Skip in normal mode
        if (!this.server || !this.isWatching)
            return;
        // Get changed files since last compile
        const changedFiles = this.extractChangedFiles(stats.compilation);
        if (changedFiles.length) {
            this.log("reloading extension...");
            this.notifyExtension({
                action: "reload",
                changedFiles,
            });
        }
    }
    /**
     * Get the changed files since
     * last compilation
     *
     * @param compilation Compilation
     */
    extractChangedFiles({ emittedAssets }) {
        return emittedAssets ? Array.from(emittedAssets) : [];
    }
    /**
     * Add Background Script to reload extension in dev mode
     *
     * @param manifest Manifest
     * @param compilation Compilation
     * @returns Promise<Manifest>
     */
    async addBackgroundscript(manifest, compilation) {
        if (!manifest.background) {
            manifest.background = undefined;
            return manifest;
        }
        this.compileClient();
        if ("service_worker" in manifest.background) {
            const { context } = compilation.options;
            if (!context) {
                // TODO: log this as an error
                return manifest;
            }
            return manifest;
        }
        this.addClient(compilation);
        if ("page" in manifest.background && manifest.background.page) {
            const { context } = compilation.options;
            if (!context) {
                // TODO: log this as an error
                return manifest;
            }
            // Insert Page
            const pagePath = path_1.default.join(context, manifest.background.page);
            const pageString = await this.readFile(pagePath, { encoding: "utf8" });
            const bodyEnd = pageString.search(/\s*<\/body>/);
            const backgroundPageStr = `${pageString.substring(0, bodyEnd)}\n<script src="${this.backgroundPagePathDefault}"></script>${pageString.substring(bodyEnd)}`;
            compilation.emitAsset(manifest.background.page, new this.sources.RawSource(backgroundPageStr));
            return manifest;
        }
        if ("scripts" in manifest.background && manifest.background.scripts) {
            // Insert Script
            manifest.background.scripts.push(this.backgroundPagePathDefault);
            return manifest;
        }
        // Insert Script
        manifest.background = { scripts: [this.backgroundPagePathDefault] };
        return manifest;
    }
    /**
     * Check if file exists
     * @param file
     * @returns Promise<boolean>
     */
    async fileExists(file) {
        try {
            await (0, promises_1.access)(file, fs_1.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the true filename (used for Typescript detections)
     * @param context
     * @param relative
     * @returns Promise<string>
     */
    async getTrueFilename(context, relative) {
        const { name, dir } = path_1.default.parse(relative);
        if (await this.fileExists(path_1.default.join(context, dir, `${name}.js`))) {
            return path_1.default.join(dir, `${name}.js`);
        }
        if (await this.fileExists(path_1.default.join(context, dir, `${name}.ts`))) {
            return path_1.default.join(dir, `${name}.ts`);
        }
        return path_1.default.join(dir, `${name}.js`);
    }
}
exports.WebextensionPlugin = WebextensionPlugin;
exports.default = WebextensionPlugin;
