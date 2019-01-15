// ==UserScript==
// @id             iitc-plugin-small-portals@setup
// @name           IITC plugin: Small Portals
// @category       Tweaks
// @version        0.0.1.20190115.21337
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/piczkaczu/iitc-new-portals/blob/master/iitc-small-portals.user.js
// @downloadURL    https://github.com/piczkaczu/iitc-new-portals/blob/master/iitc-small-portals.meta.js
// @description    [20190115.21337] Reduce size of Portal markers
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

// PLUGIN START ////////////////////////////////////////////////////////


window.plugin.lessClutter = function() {};

window.plugin.lessClutter.setup = function() {
  window.addHook('iitcLoaded', function() {
	window.getMarkerStyleOptions = function(details) {
	  var options = {
		radius: 6,
		stroke: true,
		color: COLORS[details.team],
		weight: 1,
		opacity: 1,
		fill: true,
		fillColor: COLORS[details.team],
		fillOpacity: 1,
		dashArray: null
	  };

	  return options;
	}
  });
};

var setup = window.plugin.lessClutter.setup;

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
