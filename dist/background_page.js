(()=>{"use strict";var e,o,t,n,r,i,s={991:function(e,o){var t=this&&this.__spreadArray||function(e,o,t){if(t||2===arguments.length)for(var n,r=0,i=o.length;r<i;r++)!n&&r in o||(n||(n=Array.prototype.slice.call(o,0,r)),n[r]=o[r]);return e.concat(n||Array.prototype.slice.call(o))};Object.defineProperty(o,"__esModule",{value:!0});var n=function(){function e(e){var o=void 0===e?{}:e,t=o.quiet,n=void 0!==t&&t,r=o.extension;this.quiet=n,this.browser=r,this.host="{{host}}",this.port=parseInt("{{port}}",10),this.reconnectTime=parseInt("{{reconnectTime}}",10),this.fileRegex=/[^"]*\.[a-zA-Z]+/g}return e.prototype.log=function(e){for(var o=[],n=1;n<arguments.length;n++)o[n-1]=arguments[n];this.quiet||console.log.apply(console,t(["%cwebpack-webextension-plugin: ".concat(e),"color: gray;"],o,!1))},e.prototype.getManifestFileDeps=function(){var e=this.browser.runtime.getManifest();return JSON.stringify(e).match(this.fileRegex)||[]},e.prototype.handleServerMessage=function(e){var o=e.action,t=e.changedFiles;"reload"===o?this.smartReloadExtension(t):this.log("Unknown action: %s",o)},e.prototype.smartReloadExtension=function(e){return this.log("Reloading..."),e?e.some((function(e){return"manifest.json"===e}))?(this.log("Full Reload (manifest.json changed)"),void this.browser.runtime.reload()):e.some((function(e){return/^_locales\//.test(e)}))?(this.log("Full Reload (locales changed)"),void this.browser.runtime.reload()):this.getManifestFileDeps().some((function(o){return e.includes(o)}))?(this.log("Full Reload (manifest deps changed)"),void this.browser.runtime.reload()):(this.browser.tabs.reload(),void this.browser.extension.getViews().map((function(e){return e.location.reload()}))):(this.log("Full Reload (no changed files)"),void this.browser.runtime.reload())},e.prototype.debounce=function(e,o){var t,n=this;return void 0===o&&(o=300),function(){for(var r=[],i=0;i<arguments.length;i++)r[i]=arguments[i];clearTimeout(t),t=setTimeout((function(){e.apply(n,r)}),o)}},e.prototype.connect=function(){var e=this,o=new WebSocket("ws://".concat(this.host,":").concat(this.port));o.onopen=function(){e.log("Connected")},o.onmessage=function(o){var t;try{t=JSON.parse(o.data)}catch(o){e.log("Could not parse server payload")}e.handleServerMessage(t)},o.onerror=function(){e.log("Connection error.")},o.onclose=function(){e.log("Connection lost. Reconnecting in %ss'",e.reconnectTime/1e3),e.debounce(e.connect,e.reconnectTime)}},e}();o.default=n}},a={};i=function e(o){var t=a[o];if(void 0!==t)return t.exports;var n=a[o]={exports:{}};return s[o].call(n.exports,n,n.exports,e),n.exports}(991),t=void 0===(o=(e=window).browser)?null:o,r=void 0===(n=e.chrome)?null:n,new i.default({extension:t||r}).connect()})();