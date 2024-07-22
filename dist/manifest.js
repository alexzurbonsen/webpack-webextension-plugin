"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformManifestVendorKeys = exports.transformManifestValuesFromENV = exports.validateManifest = void 0;
const ajv_1 = __importDefault(require("ajv"));
const manifest_schema_json_1 = __importDefault(require("./manifest.schema.json"));
const vendors_json_1 = __importDefault(require("./vendors.json"));
/**
 * Validate the manifest.
 */
function validateManifest(manifest) {
    if (!manifest.manifest_version) {
        return [
            {
                message: "manifest_version is required",
                dataPath: "manifest_version",
                schemaPath: "manifest_version",
                keyword: "required",
                params: {},
            },
        ];
    }
    if (typeof manifest.manifest_version !== "number") {
        return [
            {
                message: "manifest_version must be a number",
                dataPath: "manifest_version",
                schemaPath: "manifest_version",
                keyword: "type",
                params: {
                    type: "number",
                },
            },
        ];
    }
    if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
        return [
            {
                message: "manifest_version must be 2 or 3",
                dataPath: "manifest_version",
                schemaPath: "manifest_version",
                keyword: "range",
                params: {
                    min: 2,
                    max: 3,
                },
            },
        ];
    }
    const ajv = new ajv_1.default();
    const validate = ajv.compile(manifest_schema_json_1.default);
    const valid = validate(manifest);
    if (valid) {
        return null;
    }
    return validate.errors ?? null;
}
exports.validateManifest = validateManifest;
/**
 * Transform Manifest Values from ENV
 * @param manifest Manifest
 * @returns Manifest
 */
function transformManifestValuesFromENV(manifest) {
    const valueRegExp = /^__(?!MSG_)(.*)__$/;
    const replace = (value) => {
        const match = value.match(valueRegExp);
        if (match) {
            return process.env[match[1]] ?? "";
        }
        return value;
    };
    const transform = (manifestSection) => {
        if (Array.isArray(manifestSection)) {
            return manifestSection.map((m) => transform(m));
        }
        if (typeof manifestSection === "object") {
            return Object.entries(manifestSection).reduce((previousValue, [key, value]) => {
                if (typeof value === "string") {
                    previousValue[key] = replace(value);
                }
                else {
                    previousValue[key] = transform(value);
                }
                return previousValue;
            }, {});
        }
        if (typeof manifestSection === "string") {
            return replace(manifestSection);
        }
        return manifestSection;
    };
    return transform(manifest);
}
exports.transformManifestValuesFromENV = transformManifestValuesFromENV;
/**
 * Transform manifest keys
 *
 * @param manifest Manifest
 * @param vendor string
 * @returns Manifest
 */
function transformManifestVendorKeys(manifest, vendor) {
    const vendorRegExp = new RegExp(`^__((?:(?:${vendors_json_1.default.join("|")})\\|?)+)__(.*)`);
    const transform = (manifestSection) => {
        if (Array.isArray(manifestSection)) {
            return manifestSection.map((m) => transform(m));
        }
        if (typeof manifestSection === "object") {
            return Object.entries(manifestSection).reduce((previousValue, [key, value]) => {
                const match = key.match(vendorRegExp);
                if (match) {
                    const v = match[1].split("|");
                    // Swap key with non prefixed name
                    if (v.indexOf(vendor) > -1) {
                        previousValue[match[2]] = value;
                    }
                }
                else {
                    previousValue[key] = transform(value);
                }
                return previousValue;
            }, {});
        }
        return manifestSection;
    };
    return transform(manifest);
}
exports.transformManifestVendorKeys = transformManifestVendorKeys;
