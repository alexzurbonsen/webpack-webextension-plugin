/// <reference types="chrome" />
/// <reference types="firefox-webext-browser" />
import Ajv from "ajv";
/** Chrome or Mozilla */
export type Manifest = chrome.runtime.Manifest | browser._manifest.WebExtensionManifest;
export type ManifestV3 = chrome.runtime.Manifest;
/**
 * Validate the manifest.
 */
export declare function validateManifest(manifest: Manifest): Ajv.ErrorObject[] | null;
/**
 * Transform Manifest Values from ENV
 * @param manifest Manifest
 * @returns Manifest
 */
export declare function transformManifestValuesFromENV(manifest: Manifest): Manifest;
/**
 * Transform manifest keys
 *
 * @param manifest Manifest
 * @param vendor string
 * @returns Manifest
 */
export declare function transformManifestVendorKeys(manifest: Manifest, vendor: string): Manifest;
